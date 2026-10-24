"use server";

// Benutzerverwaltung (nur Büro/Admin, Rollenvergabe nur Admin — siehe permissions.ts).
// Konten werden ausschliesslich hier angelegt: es gibt keine Selbstregistrierung.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, roleList, toDbTime, type Anrede, type Role } from "@/lib/db";
import { ANREDE_WERTE } from "@/lib/db";
import { getEnv, isMailConfigured } from "@/lib/env";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { passwordResetMail, sendMail } from "@/lib/mail";
import type { FormState } from "@/lib/forms";
import { getAuthContext, revokeUserSessions } from "@/lib/auth/session";
import { canAssignRoles, canEditUser, hasRole } from "@/lib/auth/permissions";
import { passwordPolicyErrors } from "@/lib/auth/password-policy";
import { generateToken, hashPassword, hashToken } from "@/lib/auth/password";
import { RESET_TOKEN_TTL_MS } from "@/lib/auth/constants";
import { nextFreeKuerzel } from "@/lib/personen/kuerzel-server";

const emailSchema = z.email({ error: "Bitte eine gültige E-Mail-Adresse eingeben." });

interface ActionUser {
  id: string;
  email: string;
  roles: Role[];
}

/** Authentifizierter Akteur mit Verwaltungsrecht — oder Fehlerzustand. */
async function requireManager(): Promise<{ actor: ActionUser } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  }
  if (ctx.user.mustChangePassword) {
    return { failure: { error: "Bitte ändern Sie zuerst Ihr eigenes Passwort." } };
  }
  if (!hasRole(roleList(ctx.user.roles), "ADMIN") && !hasRole(roleList(ctx.user.roles), "BUERO")) {
    return { failure: { error: "Sie haben keine Berechtigung für die Benutzerverwaltung." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, roles: roleList(ctx.user.roles) } };
}

function parseRoles(formData: FormData): Role[] {
  const raw = formData.getAll("roles").map(String);
  const valid: Role[] = ["ADMIN", "CHEF", "BUERO", "LEHRPERSON", "TEILNEHMER"];
  return valid.filter((r) => raw.includes(r));
}

/**
 * System-Invariante: es muss immer mindestens eine:n aktive:n Admin geben.
 * Prüft Entzug der Admin-Rolle und Deaktivierung.
 */
async function wouldRemoveLastActiveAdmin(
  targetId: string,
  targetRoles: Role[],
  targetActive: boolean,
  newRoles: Role[],
  newActive: boolean,
): Promise<boolean> {
  const losingAdmin =
    targetActive && targetRoles.includes("ADMIN") && (!newRoles.includes("ADMIN") || !newActive);
  if (!losingAdmin) return false;

  // Array-Contains-Filter (roles @> ['ADMIN']) hat im ORM keine direkte
  // Entsprechung — bei Sprachschulgrösse ist der client-seitige Check
  // über die aktiven Konten völlig ausreichend.
  const others = await db.orm.public.User.where({ isActive: true })
    .where((u) => u.id.neq(targetId))
    .select("roles")
    .all();
  return !others.some((u) => roleList(u.roles).includes("ADMIN"));
}

/** Legt ein Konto an — Passwort direkt oder per Einladungs-Link per E-Mail. */
export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roles = parseRoles(formData);
  const mode = String(formData.get("mode") ?? "manual") === "email" ? "email" : "manual";
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (firstName.length < 2) fieldErrors.firstName = "Vorname angeben (min. 2 Zeichen)";
  if (lastName.length < 2) fieldErrors.lastName = "Nachname angeben (min. 2 Zeichen)";
  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) fieldErrors.email = emailCheck.error.issues[0]?.message ?? "Ungültige E-Mail";
  if (roles.length === 0) fieldErrors.roles = "Mindestens eine Rolle wählen";
  if (mode === "manual") {
    const policy = passwordPolicyErrors(password);
    if (policy.length > 0) fieldErrors.password = policy.join(" · ");
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  if (!canAssignRoles(actor.roles, roles)) {
    return { error: "Sie dürfen diese Rollenkombination nicht vergeben. Rollenvergabe für Admin/Chef/Büro: nur Admin." };
  }

  // E-Mail-Mode nur anbieten, wenn SMTP konfiguriert ist (in der Entwicklung
  // wird der Link stattdessen in die Server-Konsole geloggt).
  if (mode === "email") {
    const env = getEnv();
    if (!isMailConfigured(env) && env.APP_ENV !== "development") {
      return {
        error:
          "E-Mail-Versand ist nicht konfiguriert (IONOS-SMTP fehlt). Bitte setzen Sie das Passwort direkt.",
      };
    }
  }

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    return { error: "Für diese E-Mail-Adresse existiert bereits ein Konto.", fieldErrors: { email: "Bereits vergeben" } };
  }

  let inviteToken: string | null = null;
  if (mode === "email") {
    inviteToken = generateToken();
  }

  const user = await db.orm.public.User.create({
    email,
    firstName,
    lastName,
    roles,
    // Bei E-Mail-Mode setzt die Person ihr Passwort selbst über den Link.
    passwordHash: mode === "manual" ? await hashPassword(password) : null,
    mustChangePassword: true,
  });

  const meta = await getRequestMeta();
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.userCreate,
    entity: "user",
    entityId: user.id,
    summary: `Konto angelegt für ${firstName} ${lastName} (${email})`,
    details: { roles, mode },
    request: meta,
  });

  if (mode === "email" && inviteToken) {
    const env = getEnv();
    const url = `${env.APP_URL.replace(/\/$/, "")}/login/passwort-setzen?token=${inviteToken}`;
    await db.orm.public.PasswordResetToken.create({
      tokenHash: hashToken(inviteToken),
      userId: user.id,
      expiresAt: toDbTime(new Date(Date.now() + RESET_TOKEN_TTL_MS)),
    });
    const result = await sendMail(passwordResetMail(email, firstName, url, true));
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.userInviteSent,
      entity: "user",
      entityId: user.id,
      summary: `Einladungs-E-Mail an ${email} versendet`,
      details: { delivered: result.delivered, devLogged: result.devLogged },
      request: meta,
    });
  }

  revalidatePath("/benutzer");
  redirect(`/benutzer/${user.id}`);
}

/** Stammdaten und Rollen eines Kontos bearbeiten. */
export async function updateUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roles = parseRoles(formData);

  const target = await db.orm.public.User.where({ id: userId }).first();
  if (!target) return { error: "Benutzer nicht gefunden." };

  const fieldErrors: Record<string, string> = {};
  if (firstName.length < 2) fieldErrors.firstName = "Vorname angeben (min. 2 Zeichen)";
  if (lastName.length < 2) fieldErrors.lastName = "Nachname angeben (min. 2 Zeichen)";
  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) fieldErrors.email = emailCheck.error.issues[0]?.message ?? "Ungültige E-Mail";
  if (roles.length === 0) fieldErrors.roles = "Mindestens eine Rolle wählen";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  // Namen/E-Mail dürfen Büro und Admin ändern (soweit es das Konto darf),
  // Rollen nur, wer sie auch vergeben könnte.
  const targetRoles = roleList(target.roles);
  if (!canEditUser(actor.roles, targetRoles)) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }
  if (JSON.stringify([...roles].sort()) !== JSON.stringify([...targetRoles].sort()) && !canAssignRoles(actor.roles, roles)) {
    return { error: "Sie dürfen diese Rollenkombination nicht vergeben." };
  }

  if (email !== target.email) {
    const existing = await db.orm.public.User.where({ email }).first();
    if (existing) {
      return { error: "Diese E-Mail-Adresse wird bereits verwendet.", fieldErrors: { email: "Bereits vergeben" } };
    }
  }

  if (
    await wouldRemoveLastActiveAdmin(
      target.id,
      targetRoles,
      target.isActive,
      roles,
      target.isActive,
    )
  ) {
    return { error: "Es muss mindestens eine aktive Admin-Person geben. Änderung nicht möglich." };
  }

  await db.orm.public.User.where({ id: target.id }).update({ firstName, lastName, email, roles });

  // E-Mail bleibt mit der verknüpften Person der Kartei synchron (Modul 3).
  if (target.personId && email !== target.email) {
    await db.orm.public.Person.where({ id: target.personId }).update({ email });
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.userUpdate,
    entity: "user",
    entityId: target.id,
    summary: `Konto bearbeitet: ${firstName} ${lastName} (${email})`,
    details: {
      rolesChanged: JSON.stringify([...roles].sort()) !== JSON.stringify([...targetRoles].sort()),
      roles,
    },
  });

  revalidatePath("/benutzer");
  revalidatePath(`/benutzer/${target.id}`);
  return { success: "Änderungen gespeichert." };
}

/** Konto aktivieren/deaktivieren (deaktiviert = kein Login mehr). */
export async function setUserActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const target = await db.orm.public.User.where({ id: userId }).first();
  if (!target) return { error: "Benutzer nicht gefunden." };
  const targetRoles = roleList(target.roles);
  if (!canEditUser(actor.roles, targetRoles)) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }
  if (
    await wouldRemoveLastActiveAdmin(target.id, targetRoles, target.isActive, targetRoles, active)
  ) {
    return { error: "Es muss mindestens eine aktive Admin-Person geben." };
  }

  await db.orm.public.User.where({ id: target.id }).update({ isActive: active });
  if (!active) {
    await revokeUserSessions(target.id);
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.userUpdate,
    entity: "user",
    entityId: target.id,
    summary: `Konto ${active ? "aktiviert" : "deaktiviert"}: ${target.email}`,
  });

  revalidatePath("/benutzer");
  revalidatePath(`/benutzer/${target.id}`);
  return { success: active ? "Konto aktiviert." : "Konto deaktiviert; laufende Sitzungen wurden beendet." };
}

/** Passwort durch Admin/Büro neu setzen — oder Link per E-Mail schicken. */
export async function adminSetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const mode = String(formData.get("mode") ?? "manual") === "email" ? "email" : "manual";
  const password = String(formData.get("password") ?? "");

  const target = await db.orm.public.User.where({ id: userId }).first();
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (!canEditUser(actor.roles, roleList(target.roles))) {
    return { error: "Sie dürfen für dieses Konto kein Passwort setzen." };
  }

  if (mode === "manual") {
    const policy = passwordPolicyErrors(password);
    if (policy.length > 0) {
      return { error: "Das Passwort erfüllt die Anforderungen nicht.", fieldErrors: { password: policy.join(" · ") } };
    }
    await db.orm.public.User.where({ id: target.id }).update({
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    });
    const revoked = await revokeUserSessions(target.id);
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.userPasswordSetByAdmin,
      entity: "user",
      entityId: target.id,
      summary: `Passwort durch Verwaltung neu gesetzt für ${target.email}`,
      details: { revokedSessions: revoked },
    });
    revalidatePath(`/benutzer/${target.id}`);
    return { success: "Passwort gesetzt. Die Person muss es bei der nächsten Anmeldung ändern; alle Sitzungen wurden beendet." };
  }

  // E-Mail-Mode: alten Links entwerten, neuen versenden.
  await db.orm.public.PasswordResetToken.where({ userId: target.id, usedAt: null }).updateAll({
    usedAt: toDbTime(new Date()),
  });
  const token = generateToken();
  await db.orm.public.PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId: target.id,
    expiresAt: toDbTime(new Date(Date.now() + RESET_TOKEN_TTL_MS)),
  });
  const env = getEnv();
  const url = `${env.APP_URL.replace(/\/$/, "")}/login/passwort-setzen?token=${token}`;
  const result = await sendMail(passwordResetMail(target.email, target.firstName, url, !target.passwordHash));

  if (!result.delivered && !result.devLogged) {
    await db.orm.public.PasswordResetToken.where({ tokenHash: hashToken(token) }).update({
      usedAt: toDbTime(new Date()),
    });
    return {
      error:
        "Die E-Mail konnte nicht versendet werden (SMTP nicht konfiguriert oder fehlerhaft). Bitte setzen Sie das Passwort direkt.",
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.userInviteSent,
    entity: "user",
    entityId: target.id,
    summary: `Passwort-Link per E-Mail an ${target.email} versendet`,
    details: { delivered: result.delivered },
  });
  revalidatePath(`/benutzer/${target.id}`);
  return { success: `E-Mail mit Link an ${target.email} versendet (60 Minuten gültig).` };
}

/** Alle Sitzungen eines Kontos beenden (z.B. bei Verdacht auf Missbrauch). */
export async function revokeUserSessionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const target = await db.orm.public.User.where({ id: userId }).first();
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (!canEditUser(actor.roles, roleList(target.roles))) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }

  const revoked = await revokeUserSessions(target.id);
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.userSessionsRevoked,
    entity: "user",
    entityId: target.id,
    summary: `Alle Sitzungen beendet für ${target.email}`,
    details: { revokedSessions: revoked },
  });
  revalidatePath(`/benutzer/${target.id}`);
  return { success: revoked > 0 ? `${revoked} Sitzung(en) beendet.` : "Es gab keine laufenden Sitzungen." };
}

// ——— Konto ↔ Person (Modul 3): jeder User gehört zu einer Person der Kartei ——

/** Konto mit einer bestehenden Person der Kartei verknüpfen. */
export async function linkUserPersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return { error: "Bitte eine Person auswählen." };

  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) return { error: "Konto nicht gefunden." };
  if (!canEditUser(actor.roles, roleList(user.roles))) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }
  if (user.personId) return { error: "Dieses Konto ist bereits mit einer Person verknüpft." };

  const person = await db.orm.public.Person.where({ id: personId }).include("user").first();
  if (!person) return { error: "Person nicht gefunden." };
  if (person.user) {
    return { error: "Diese Person ist bereits mit einem anderen Konto verknüpft." };
  }

  await db.orm.public.User.where({ id: userId }).update({ personId });
  await recordAudit({
    actor,
    action: "user.person_link",
    entity: "user",
    entityId: userId,
    summary: `Konto ${user.email} mit Person «${person.vorname} ${person.nachname}» verknüpft`,
    details: { personId },
  });
  revalidatePath(`/benutzer/${userId}`);
  revalidatePath(`/personen/${personId}`);
  return { success: `Konto mit ${person.vorname} ${person.nachname} verknüpft.` };
}

/** Verknüpfung zwischen Konto und Person lösen (E-Mails bleiben unabhängig). */
export async function unlinkUserPersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) return { error: "Konto nicht gefunden." };
  if (!canEditUser(actor.roles, roleList(user.roles))) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }
  if (!user.personId) return { error: "Dieses Konto ist nicht mit einer Person verknüpft." };

  const personId = user.personId;
  await db.orm.public.User.where({ id: userId }).update({ personId: null });
  await recordAudit({
    actor,
    action: "user.person_unlink",
    entity: "user",
    entityId: userId,
    summary: `Konto ${user.email} von seiner Person gelöst`,
    details: { personId },
  });
  revalidatePath(`/benutzer/${userId}`);
  revalidatePath(`/personen/${personId}`);
  return { success: "Verknüpfung gelöst." };
}

/** Person der Kartei direkt aus den Kontodaten anlegen und verknüpfen. */
export async function createPersonForUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const userId = String(formData.get("userId") ?? "");
  const anredeRaw = String(formData.get("anrede") ?? "") as Anrede;
  if (!ANREDE_WERTE.includes(anredeRaw)) {
    return { error: "Bitte eine Anrede wählen.", fieldErrors: { anrede: "Pflichtfeld" } };
  }

  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) return { error: "Konto nicht gefunden." };
  if (!canEditUser(actor.roles, roleList(user.roles))) {
    return { error: "Sie dürfen dieses Konto nicht bearbeiten." };
  }
  if (user.personId) return { error: "Dieses Konto ist bereits mit einer Person verknüpft." };

  const roles = roleList(user.roles);
  const istLehrperson = roles.includes("LEHRPERSON");
  const kuerzel = istLehrperson ? await nextFreeKuerzel(user.firstName, user.lastName) : null;

  const person = await db.orm.public.Person.create({
    status: "AKTIV",
    anrede: anredeRaw,
    vorname: user.firstName,
    nachname: user.lastName,
    email: user.email,
    istLehrperson,
    kuerzel,
  });
  await db.orm.public.User.where({ id: userId }).update({ personId: person.id });

  await recordAudit({
    actor,
    action: "person.create",
    entity: "person",
    entityId: person.id,
    summary: `Person «${person.vorname} ${person.nachname}» aus dem Konto ${user.email} angelegt`,
    details: { userId, istLehrperson, kuerzel },
  });
  revalidatePath(`/benutzer/${userId}`);
  revalidatePath("/personen");
  revalidatePath("/dashboard");
  return { success: `Person «${person.vorname} ${person.nachname}» angelegt und verknüpft.` };
}
