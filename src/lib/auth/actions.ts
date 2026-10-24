"use server";

// Auth-Server-Actions: Login, Logout, Passwort-Reset per E-Mail-Link,
// Passwort ändern. Server Actions sind öffentlich per POST erreichbar —
// jede Action prüft daher ihre eigenen Voraussetzungen.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, fromDbTime, toDbTime, type Role } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { passwordResetMail, sendMail } from "@/lib/mail";
import type { FormState } from "@/lib/forms";
import {
  cleanupAuthEvents,
  isLoginLocked,
  isResetThrottled,
  recordAuthEvent,
} from "./bruteforce";
import { RESET_TOKEN_TTL_MS } from "./constants";
import { passwordPolicyErrors } from "./password-policy";
import { fakeVerifyPassword, generateToken, hashPassword, hashToken, verifyPassword } from "./password";
import { createSession, destroyCurrentSession, getAuthContext, revokeUserSessions } from "./session";
import { landingRoute } from "./permissions";

const emailSchema = z.email({ error: "Bitte eine gültige E-Mail-Adresse eingeben." });

function normalizeEmail(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().toLowerCase();
}

function safeNextPath(raw: FormDataEntryValue | null): string | null {
  const next = String(raw ?? "");
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) {
    return next;
  }
  return null;
}

/** Login: prüft Brute-Force-Sperre, meldet generische Fehler (keine Konten-Erkennung). */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }
  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) {
    return { error: emailCheck.error.issues[0]?.message ?? "Ungültige E-Mail-Adresse." };
  }

  const meta = await getRequestMeta();
  if (await isLoginLocked(email, meta.ip)) {
    return {
      error: "Zu viele fehlgeschlagene Anmeldungen. Bitte warten Sie ca. 15 Minuten und versuchen Sie es erneut.",
    };
  }

  const user = await db.orm.public.User.where({ email }).first();
  let valid = false;
  if (user?.passwordHash) {
    valid = await verifyPassword(password, user.passwordHash);
  } else {
    // Gleichmässige Antwortzeit, auch wenn das Konto nicht existiert.
    await fakeVerifyPassword(password);
  }

  if (!user || !valid) {
    await recordAuthEvent({ kind: "LOGIN", email, ip: meta.ip, success: false });
    if (user) {
      await recordAudit({
        actor: null,
        action: AUDIT_ACTIONS.userLoginFailed,
        entity: "user",
        entityId: user.id,
        summary: `Fehlgeschlagene Anmeldung für ${email}`,
        request: meta,
      });
    }
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  if (!user.isActive) {
    await recordAuthEvent({ kind: "LOGIN", email, ip: meta.ip, success: false });
    await recordAudit({
      actor: { id: user.id, email: user.email },
      action: AUDIT_ACTIONS.userLoginFailed,
      entity: "user",
      entityId: user.id,
      summary: `Anmeldeversuch auf deaktiviertes Konto ${email}`,
      details: { reason: "inactive" },
      request: meta,
    });
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  await recordAuthEvent({ kind: "LOGIN", email, ip: meta.ip, success: true });
  await createSession(user.id, meta);
  await db.orm.public.User.where({ id: user.id }).update({ lastLoginAt: toDbTime(new Date()) });
  await recordAudit({
    actor: { id: user.id, email: user.email },
    action: AUDIT_ACTIONS.userLogin,
    entity: "user",
    entityId: user.id,
    summary: `Anmeldung von ${user.firstName} ${user.lastName}`,
    request: meta,
  });
  void cleanupAuthEvents().catch(() => undefined);

  const next = safeNextPath(formData.get("next"));
  redirect(user.mustChangePassword ? "/passwort-aendern" : (next ?? landingRoute(user.roles as Role[])));
}

export async function logoutAction(): Promise<void> {
  const ctx = await getAuthContext();
  if (ctx) {
    await recordAudit({
      actor: { id: ctx.user.id, email: ctx.user.email },
      action: AUDIT_ACTIONS.userLogout,
      entity: "user",
      entityId: ctx.user.id,
      summary: `Abmeldung von ${ctx.user.firstName} ${ctx.user.lastName}`,
    });
  }
  await destroyCurrentSession();
  redirect("/login");
}

/** Passwort-Reset anfordern: antwortet immer gleichlautend (keine Konten-Erkennung). */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) {
    return { error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  }
  const emailCheck = emailSchema.safeParse(email);
  if (!emailCheck.success) {
    return { error: emailCheck.error.issues[0]?.message ?? "Ungültige E-Mail-Adresse." };
  }

  const meta = await getRequestMeta();
  const genericSuccess: FormState = {
    success:
      "Sofern ein Konto mit dieser E-Mail-Adresse existiert, haben wir Ihnen einen Link zum Setzen eines neuen Passworts geschickt. Der Link ist 60 Minuten gültig.",
  };

  if (await isResetThrottled(email, meta.ip)) {
    // Gedrosselt: nicht verraten, nur nicht noch eine Mail senden.
    return genericSuccess;
  }
  await recordAuthEvent({ kind: "PASSWORD_RESET", email, ip: meta.ip, success: true });

  const user = await db.orm.public.User.where({ email, isActive: true }).first();
  if (!user) {
    return genericSuccess;
  }

  // Alte, unbenutzte Links entwerten.
  await db.orm.public.PasswordResetToken.where({ userId: user.id, usedAt: null }).updateAll({
    usedAt: toDbTime(new Date()),
  });

  const token = generateToken();
  await db.orm.public.PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: toDbTime(new Date(Date.now() + RESET_TOKEN_TTL_MS)),
  });

  const env = getEnv();
  const url = `${env.APP_URL.replace(/\/$/, "")}/login/passwort-setzen?token=${token}`;
  const mail = passwordResetMail(user.email, user.firstName, url, false);
  const result = await sendMail(mail);

  await recordAudit({
    actor: { id: user.id, email: user.email },
    action: AUDIT_ACTIONS.userPasswordResetRequested,
    entity: "user",
    entityId: user.id,
    summary: `Passwort-Reset angefordert für ${user.email}`,
    details: { delivered: result.delivered, devLogged: result.devLogged },
    request: meta,
  });

  return genericSuccess;
}

/** Neues Passwort per Einmal-Link setzen (Reset oder Ersteinrichtung). */
export async function resetPasswordWithTokenAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) {
    return { error: "Ungültiger Link. Bitte fordern Sie einen neuen Link an." };
  }
  if (password !== confirm) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }
  const policy = passwordPolicyErrors(password);
  if (policy.length > 0) {
    return { error: "Das Passwort erfüllt die Anforderungen noch nicht.", fieldErrors: { password: policy.join(" · ") } };
  }

  const record = await db.orm.public.PasswordResetToken.where({ tokenHash: hashToken(token) })
    .include("user")
    .first();
  if (
    !record ||
    record.usedAt !== null ||
    fromDbTime(record.expiresAt).getTime() < Date.now() ||
    !record.user.isActive
  ) {
    return { error: "Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen Link an." };
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: record.userId }).update({
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
    });
    await tx.orm.public.PasswordResetToken.where({ id: record.id }).update({
      usedAt: toDbTime(new Date()),
    });
  });
  await revokeUserSessions(record.userId);

  await recordAudit({
    actor: { id: record.user.id, email: record.user.email },
    action: AUDIT_ACTIONS.userPasswordResetCompleted,
    entity: "user",
    entityId: record.user.id,
    summary: `Passwort per E-Mail-Link neu gesetzt für ${record.user.email}`,
  });

  redirect("/login?reset=ok");
}

/** Eigenes Passwort ändern (freiwillig oder erzwungen nach Erstvergabe). */
export async function changeOwnPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!ctx.user.passwordHash) {
    return { error: "Für Ihr Konto ist kein Passwort gesetzt. Bitte nutzen Sie den Link aus der Einladungs-E-Mail." };
  }
  if (!(await verifyPassword(currentPassword, ctx.user.passwordHash))) {
    return { error: "Das aktuelle Passwort ist nicht korrekt.", fieldErrors: { currentPassword: "Falsches Passwort" } };
  }
  if (password !== confirm) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }
  const policy = passwordPolicyErrors(password);
  if (policy.length > 0) {
    return { error: "Das Passwort erfüllt die Anforderungen noch nicht.", fieldErrors: { password: policy.join(" · ") } };
  }

  await db.orm.public.User.where({ id: ctx.user.id }).update({
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
  });
  // Andere Geräte ausloggen, die aktuelle Session bleibt.
  await revokeUserSessions(ctx.user.id, ctx.session.id);

  await recordAudit({
    actor: { id: ctx.user.id, email: ctx.user.email },
    action: AUDIT_ACTIONS.userPasswordChange,
    entity: "user",
    entityId: ctx.user.id,
    summary: `Eigenes Passwort geändert (${ctx.user.email})`,
  });

  revalidatePath("/passwort-aendern");
  return { success: "Passwort geändert. Alle anderen Sitzungen wurden abgemeldet." };
}
