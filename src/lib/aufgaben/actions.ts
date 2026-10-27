"use server";

// Aufgaben (Modul 13, Server-Actions): schlichtes Aufgaben-System — anlegen,
// bearbeiten, erledigen, wieder öffnen, löschen. Verknüpfungen zu Person/
// Kurs/Anfrage sind optional (nullable FKs). Alles im Audit-Log (aufgabe.*);
// die Automatik-Aufgaben (Anfrage/Paket-Ende/Anwesenheit) laufen separat über
// src/lib/aufgaben/automatik.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isForeignKeyViolation, roleList, toDbTime } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageAnfragen } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { dateKeyToUtcMidnight, parseDateKey } from "@/lib/zeit";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireAufgabenManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageAnfragen(roleList(ctx.user.roles))) {
    return { failure: { error: "Das Aufgaben-System ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidateAufgaben(...paths: string[]) {
  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  revalidatePath("/anfragen");
  revalidatePath("/personen");
  for (const p of paths) revalidatePath(p);
}

/**
 * Aufgabe anlegen oder bearbeiten (Titel, Beschreibung, Zugewiesene:r,
 * Fälligkeit, Verknüpfungen). Automatik-Aufgaben (mit quelle != manual und
 * dedupKey) sind in Titel nicht editierbar — nur Fälligkeit/Beauftragung.
 */
export async function saveAufgabeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAufgabenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const titel = str(formData, "titel");
  const beschreibung = str(formData, "beschreibung") || null;
  const assigneeUserId = str(formData, "assigneeUserId") || null;
  const faelligRaw = str(formData, "faelligAm");
  const personId = str(formData, "personId") || null;
  const kursId = str(formData, "kursId") || null;

  const fieldErrors: Record<string, string> = {};
  if (!titel) fieldErrors.titel = "Pflichtfeld";
  if (faelligRaw && !parseDateKey(faelligRaw)) fieldErrors.faelligAm = "Gültiges Datum wählen";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  if (assigneeUserId) {
    const assignee = await db.orm.public.User.where({ id: assigneeUserId }).first();
    if (!assignee) return { error: "Zugewiesene Person nicht gefunden." };
  }
  if (personId) {
    const person = await db.orm.public.Person.where({ id: personId }).first();
    if (!person) return { error: "Person nicht gefunden." };
  }
  if (kursId) {
    const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
    if (!kurs) return { error: "Kurs nicht gefunden." };
  }

  const faelligAm = faelligRaw ? toDbTime(dateKeyToUtcMidnight(faelligRaw)) : null;
  const daten = { titel, beschreibung, assigneeUserId, faelligAm, personId, kursId };

  try {
    if (id) {
      const bestehend = await db.orm.public.Aufgabe.where({ id }).first();
      if (!bestehend) return { error: "Aufgabe nicht gefunden." };
      await db.orm.public.Aufgabe.where({ id }).update(daten);
      await recordAudit({
        actor,
        action: "aufgabe.geaendert",
        entity: "aufgabe",
        entityId: id,
        summary: `Aufgabe «${titel}» geändert`,
        details: daten,
      });
      revalidateAufgaben(`/aufgaben/${id}`);
      return { success: "Aufgabe gespeichert." };
    }
    const created = await db.orm.public.Aufgabe.create({ ...daten, status: "OFFEN", quelle: "manual" });
    await recordAudit({
      actor,
      action: "aufgabe.erstellt",
      entity: "aufgabe",
      entityId: created.id,
      summary: `Aufgabe «${titel}» angelegt`,
      details: daten,
    });
    revalidateAufgaben(`/aufgaben/${created.id}`);
    return { success: "Aufgabe angelegt." };
  } catch (error) {
    if (isForeignKeyViolation(error)) return { error: "Verknüpfung ungültig — bitte erneut wählen." };
    console.error("Aufgabe speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

/** Aufgabe erledigen (aus der Liste oder der Detailseite). */
export async function erledigeAufgabeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAufgabenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "aufgabeId");
  const aufgabe = await db.orm.public.Aufgabe.where({ id }).first();
  if (!aufgabe) return { error: "Aufgabe nicht gefunden." };
  if (aufgabe.status === "ERLEDIGT") return { error: "Die Aufgabe ist bereits erledigt." };

  await db.orm.public.Aufgabe.where({ id }).update({
    status: "ERLEDIGT",
    erledigtAt: toDbTime(new Date()),
    erledigtVonName: actor.name,
  });
  await recordAudit({
    actor,
    action: "aufgabe.erledigt",
    entity: "aufgabe",
    entityId: id,
    summary: `Aufgabe «${aufgabe.titel}» erledigt`,
  });
  revalidateAufgaben(`/aufgaben/${id}`);
  return { success: "Aufgabe erledigt." };
}

/** Erledigte Aufgabe wieder öffnen. */
export async function oeffneAufgabeWiederAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAufgabenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "aufgabeId");
  const aufgabe = await db.orm.public.Aufgabe.where({ id }).first();
  if (!aufgabe) return { error: "Aufgabe nicht gefunden." };
  if (aufgabe.status === "OFFEN") return { error: "Die Aufgabe ist bereits offen." };

  await db.orm.public.Aufgabe.where({ id }).update({
    status: "OFFEN",
    erledigtAt: null,
    erledigtVonName: null,
  });
  await recordAudit({
    actor,
    action: "aufgabe.wieder_geoeffnet",
    entity: "aufgabe",
    entityId: id,
    summary: `Aufgabe «${aufgabe.titel}» wieder geöffnet`,
  });
  revalidateAufgaben(`/aufgaben/${id}`);
  return { success: "Aufgabe wieder geöffnet." };
}

/** Aufgabe löschen (mit Bestätigung; Automatik darf sie danach neu anlegen). */
export async function loescheAufgabeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAufgabenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "aufgabeId");
  const aufgabe = await db.orm.public.Aufgabe.where({ id }).first();
  if (!aufgabe) return { error: "Aufgabe nicht gefunden." };

  await db.orm.public.Aufgabe.where({ id }).delete();
  await recordAudit({
    actor,
    action: "aufgabe.geloescht",
    entity: "aufgabe",
    entityId: id,
    summary: `Aufgabe «${aufgabe.titel}» gelöscht (${aufgabe.quelle})`,
  });
  revalidateAufgaben();
  // Nach dem Löschen landet man wieder in der Liste.
  redirect("/aufgaben");
}
