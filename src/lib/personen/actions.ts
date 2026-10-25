"use server";

// Personenverwaltung (Modul 3): eine Kartei für alle Personen der Schule.
// Sehen und pflegen dürfen Admin, Chef und Büro (Pflichtenheft: Chef darf
// «alles sehen/bearbeiten ausser Rechtevergabe», Büro operativ). Jede Änderung
// läuft über den Audit-Log.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  db,
  isForeignKeyViolation,
  isUniqueViolation,
  ANREDE_WERTE,
  PERSON_STATUS_WERTE,
  type Anrede,
  type PersonStatus,
  type PersonRow,
} from "@/lib/db";
import { roleList } from "@/lib/domain";
import { getAuthContext } from "@/lib/auth/session";
import { canManagePersonen } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { kuerzelBasis } from "./kuerzel";
import { nextFreeKuerzel } from "./kuerzel-server";

const emailSchema = z.email({ error: "Bitte eine gültige E-Mail-Adresse eingeben." });

interface ActionUser {
  id: string;
  email: string;
  name: string;
}

async function requireManager(): Promise<{ actor: ActionUser } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManagePersonen(roleList(ctx.user.roles))) {
    return { failure: { error: "Die Personenverwaltung ist Admin, Chef und Büro vorbehalten." } };
  }
  return {
    actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` },
  };
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const checked = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

function personLabel(p: { vorname: string; nachname: string }): string {
  return `${p.vorname} ${p.nachname}`;
}

function revalidatePerson(...paths: string[]) {
  revalidatePath("/personen");
  revalidatePath("/dashboard");
  revalidatePath("/benutzer");
  for (const p of paths) revalidatePath(p);
}

/**
 * Person anlegen oder bearbeiten. Beim ersten Führen als Lehrperson wird das
 * Kürzel automatisch erzeugt und bleibt danach stabil (Kurscodes verweisen
 * darauf). Bei verknüpftem Konto bleibt die E-Mail mit User.email synchron.
 */
export async function savePersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const vorname = str(formData, "vorname");
  const nachname = str(formData, "nachname");
  const emailRaw = str(formData, "email").toLowerCase();
  const anrede = str(formData, "anrede") as Anrede;
  const statusRaw = str(formData, "status") as PersonStatus;
  const istLehrperson = checked(formData, "istLehrperson");
  const rechnungAbweichend = checked(formData, "rechnungAbweichend");

  const fieldErrors: Record<string, string> = {};
  if (!ANREDE_WERTE.includes(anrede)) fieldErrors.anrede = "Pflichtfeld";
  if (vorname.length < 2) fieldErrors.vorname = "Mindestens 2 Zeichen";
  if (nachname.length < 2) fieldErrors.nachname = "Mindestens 2 Zeichen";
  if (emailRaw && !emailSchema.safeParse(emailRaw).success) {
    fieldErrors.email = "Ungültige E-Mail-Adresse";
  }
  if (istLehrperson && !kuerzelBasis(vorname, nachname)) {
    fieldErrors.nachname = "Kürzel nicht ableitbar — Nachname braucht Buchstaben";
  }
  const status = PERSON_STATUS_WERTE.includes(statusRaw) ? statusRaw : "INTERESSENT";
  if (Object.keys(fieldErrors).length > 0) return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };

  const data = {
    status,
    anrede,
    vorname,
    nachname,
    email: emailRaw || null,
    strasse: str(formData, "strasse") || null,
    plz: str(formData, "plz") || null,
    ort: str(formData, "ort") || null,
    rechnungStrasse: rechnungAbweichend ? str(formData, "rechnungStrasse") || null : null,
    rechnungPlz: rechnungAbweichend ? str(formData, "rechnungPlz") || null : null,
    rechnungOrt: rechnungAbweichend ? str(formData, "rechnungOrt") || null : null,
    telefon1: str(formData, "telefon1") || null,
    whatsapp1: checked(formData, "whatsapp1"),
    signal1: checked(formData, "signal1"),
    telefon2: str(formData, "telefon2") || null,
    whatsapp2: checked(formData, "whatsapp2"),
    signal2: checked(formData, "signal2"),
    istLehrperson,
  };

  let createdId: string | null = null;
  try {
    let row: PersonRow | null | undefined;
    if (id) {
      const existing = await db.orm.public.Person.where({ id }).include("user").first();
      if (!existing) return { error: "Person nicht gefunden." };

      // E-Mail = Login: bei verknüpftem Konto muss sie gesetzt bleiben und
      // wird (nach Unique-Prüfung) aufs Konto synchronisiert.
      const linkedUser = existing.user;
      if (linkedUser) {
        if (!data.email) {
          return { error: "Diese Person hat ein Konto — die E-Mail (= Login) ist nötig.", fieldErrors: { email: "Pflichtfeld" } };
        }
        if (data.email !== linkedUser.email) {
          const clash = await db.orm.public.User.where({ email: data.email }).first();
          if (clash) {
            return { error: "Diese E-Mail-Adresse verwendet bereits ein anderes Konto.", fieldErrors: { email: "Bereits vergeben" } };
          }
        }
      }

      // Kürzel bleibt stabil; nur beim erstmaligen Führen als Lehrperson wird es erzeugt.
      const kuerzel = istLehrperson && !existing.kuerzel ? await nextFreeKuerzel(vorname, nachname) : existing.kuerzel;
      row = await db.orm.public.Person.where({ id }).update({ ...data, kuerzel });

      if (linkedUser && data.email && data.email !== linkedUser.email) {
        await db.orm.public.User.where({ id: linkedUser.id }).update({ email: data.email });
      }
    } else {
      // Anlegen; bei einer Kürzel-Kollision (Gleichlauf) Suffix neu berechnen.
      for (let attempt = 0; ; attempt++) {
        try {
          const kuerzel = istLehrperson ? await nextFreeKuerzel(vorname, nachname) : null;
          row = await db.orm.public.Person.create({ ...data, kuerzel });
          break;
        } catch (error) {
          if (isUniqueViolation(error) && istLehrperson && attempt < 10) continue;
          throw error;
        }
      }
    }
    if (!row) return { error: "Speichern fehlgeschlagen." };

    await recordAudit({
      actor,
      action: id ? "person.update" : "person.create",
      entity: "person",
      entityId: row.id,
      summary: `Person «${personLabel(data)}» ${id ? "geändert" : "angelegt"}`,
      details: { status: data.status, istLehrperson: data.istLehrperson, kuerzel: row.kuerzel ?? null },
    });

    revalidatePerson(`/personen/${row.id}`);
    createdId = row.id;
  } catch (error) {
    console.error("Person speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }

  // redirect() wirft — bewusst ausserhalb des try/catch.
  if (!id && createdId) redirect(`/personen/${createdId}`);
  return { success: "Person gespeichert." };
}

// ——— CRM-Notizen (Autor + Datum) ———————————————————————————————————

export async function addNotizAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const personId = str(formData, "personId");
  const text = str(formData, "text");
  if (text.length < 2) {
    return { error: "Bitte einen Notiztext eingeben.", fieldErrors: { text: "Mindestens 2 Zeichen" } };
  }
  const person = await db.orm.public.Person.where({ id: personId }).first();
  if (!person) return { error: "Person nicht gefunden." };

  await db.orm.public.PersonNotiz.create({
    personId,
    text,
    authorUserId: actor.id,
    authorName: actor.name,
  });
  await recordAudit({
    actor,
    action: "person.notiz_create",
    entity: "person",
    entityId: personId,
    summary: `CRM-Notiz zu «${personLabel(person)}» erfasst`,
  });
  revalidatePerson(`/personen/${personId}`);
  return { success: "Notiz erfasst." };
}

export async function deleteNotizAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const notizId = str(formData, "notizId");
  const notiz = await db.orm.public.PersonNotiz.where({ id: notizId }).first();
  if (!notiz) return { error: "Notiz nicht gefunden." };

  await db.orm.public.PersonNotiz.where({ id: notizId }).delete();
  await recordAudit({
    actor,
    action: "person.notiz_delete",
    entity: "person",
    entityId: notiz.personId,
    summary: `CRM-Notiz zu einer Person gelöscht (Autor: ${notiz.authorName})`,
  });
  revalidatePerson(`/personen/${notiz.personId}`);
  return { success: "Notiz gelöscht." };
}

// ——— Familie: Eltern/Erziehungsberechtigte ↔ Kinder —————————————————

export async function addBeziehungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const kindId = str(formData, "kindId");
  const berechtigterId = str(formData, "berechtigterId");
  if (!kindId || !berechtigterId) return { error: "Bitte eine Person auswählen." };
  if (kindId === berechtigterId) {
    return { error: "Eine Person kann nicht ihre eigene Erziehungsberechtigte sein." };
  }

  const [kind, berechtigter] = await Promise.all([
    db.orm.public.Person.where({ id: kindId }).first(),
    db.orm.public.Person.where({ id: berechtigterId }).first(),
  ]);
  if (!kind || !berechtigter) return { error: "Person nicht gefunden." };

  const existing = await db.orm.public.PersonBeziehung
    .where({ kindId, berechtigterId })
    .first();
  if (existing) return { error: "Diese Verknüpfung besteht bereits." };

  await db.orm.public.PersonBeziehung.create({ kindId, berechtigterId });
  await recordAudit({
    actor,
    action: "person.beziehung_create",
    entity: "person",
    entityId: kindId,
    summary: `«${personLabel(berechtigter)}» als Erziehungsberechtigte:r von «${personLabel(kind)}» verknüpft`,
    details: { kindId, berechtigterId },
  });
  revalidatePerson(`/personen/${kindId}`, `/personen/${berechtigterId}`);
  return {
    success: `«${personLabel(berechtigter)}» mit «${personLabel(kind)}» verknüpft.`,
  };
}

export async function removeBeziehungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const beziehungId = str(formData, "beziehungId");
  const beziehung = await db.orm.public.PersonBeziehung.where({ id: beziehungId }).first();
  if (!beziehung) return { error: "Verknüpfung nicht gefunden." };

  await db.orm.public.PersonBeziehung.where({ id: beziehungId }).delete();
  await recordAudit({
    actor,
    action: "person.beziehung_remove",
    entity: "person",
    entityId: beziehung.kindId,
    summary: `Familien-Verknüpfung gelöst (Kind ${beziehung.kindId} ↔ Erziehungsberechtigte:r ${beziehung.berechtigterId})`,
  });
  revalidatePerson(`/personen/${beziehung.kindId}`, `/personen/${beziehung.berechtigterId}`);
  return { success: "Verknüpfung gelöst." };
}

// ——— Lehrpersonen-Qualifikationen (Sprache × Niveau) ————————————————

export async function addQualifikationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const personId = str(formData, "personId");
  const spracheId = str(formData, "spracheId");
  const niveauId = str(formData, "niveauId");
  if (!spracheId || !niveauId) {
    return { error: "Bitte Sprache und Niveau auswählen." };
  }
  const person = await db.orm.public.Person.where({ id: personId }).first();
  if (!person) return { error: "Person nicht gefunden." };
  if (!person.istLehrperson) {
    return { error: "Diese Person ist nicht als Lehrperson geführt. Bitte zuerst im Formular oben aktivieren." };
  }

  try {
    await db.orm.public.Lehrqualifikation.create({ personId, spracheId, niveauId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Diese Sprache-Niveau-Kombination ist bereits erfasst." };
    }
    console.error("Qualifikation speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
  await recordAudit({
    actor,
    action: "person.qualifikation_create",
    entity: "person",
    entityId: personId,
    summary: `Qualifikation für «${personLabel(person)}» erfasst`,
    details: { spracheId, niveauId },
  });
  revalidatePerson(`/personen/${personId}`);
  return { success: "Qualifikation erfasst." };
}

export async function removeQualifikationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const qualId = str(formData, "qualifikationId");
  const qual = await db.orm.public.Lehrqualifikation.where({ id: qualId }).first();
  if (!qual) return { error: "Qualifikation nicht gefunden." };

  await db.orm.public.Lehrqualifikation.where({ id: qualId }).delete();
  await recordAudit({
    actor,
    action: "person.qualifikation_remove",
    entity: "person",
    entityId: qual.personId,
    summary: `Qualifikation entfernt (Sprache ${qual.spracheId} × Niveau ${qual.niveauId})`,
  });
  revalidatePerson(`/personen/${qual.personId}`);
  return { success: "Qualifikation entfernt." };
}

// ——— Person löschen (nur wenn unbenutzt) ————————————————————————————

export async function deletePersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const person = await db.orm.public.Person.where({ id }).include("user").first();
  if (!person) return { error: "Person nicht gefunden." };
  if (person.user) {
    return {
      error:
        "Diese Person hat ein verknüpftes Konto. Bitte zuerst die Verknüpfung in der Benutzerverwaltung lösen.",
    };
  }
  const [eltern, kinder, qualifikationen, honorarSaetze, honorarAbrechnungen] = await Promise.all([
    db.orm.public.PersonBeziehung.where({ kindId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.PersonBeziehung.where({ berechtigterId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.Lehrqualifikation.where({ personId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.HonorarSatz.where({ lehrpersonId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.HonorarAbrechnung.where({ lehrpersonId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  if (eltern + kinder > 0) {
    return { error: "Familien-Verknüpfungen zuerst lösen, dann kann die Person gelöscht werden." };
  }
  if (qualifikationen > 0) {
    return { error: "Qualifikationen zuerst entfernen, dann kann die Person gelöscht werden." };
  }
  if (honorarSaetze + honorarAbrechnungen > 0) {
    return {
      error:
        "Diese Person hat Honorar-Daten (Sätze in der Honorar-Matrix oder Monats-Abrechnungen), die historisch erhalten bleiben müssen — bitte den Status auf «inaktiv» setzen statt zu löschen.",
    };
  }

  try {
    // CRM-Notizen laufen als historische Daten mit (Cascade).
    await db.orm.public.Person.where({ id }).delete();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return {
        error: "Diese Person wird bereits verwendet (z.B. Kurse, Anmeldungen, Rechnungen) und kann nicht gelöscht werden.",
      };
    }
    console.error("Person löschen fehlgeschlagen:", error);
    return { error: "Löschen fehlgeschlagen." };
  }

  await recordAudit({
    actor,
    action: "person.delete",
    entity: "person",
    entityId: id,
    summary: `Person «${personLabel(person)}» gelöscht (inkl. CRM-Notizen)`,
  });
  revalidatePerson();
  return { success: `Person «${personLabel(person)}» gelöscht.` };
}
