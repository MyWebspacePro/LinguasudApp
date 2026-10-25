"use server";

// Server-Actions der Dienst- & Urlaubsplanung (Modul 8): Pensum-Blöcke,
// Tages-Abweichungen, Abwesenheiten (Urlaub/Krankheit/sonstige) und das
// anpassbare Urlaubs-Jahreskontingent. Nur Admin/Chef/Büro; die Ziel-Person
// muss ein BUERO/ADMIN/CHEF-Konto haben (Lehrpersonen ausgenommen). Alles
// über den Audit-Log; reine Datumsfelder als UTC-Mitternacht (dbDatum).

import { revalidatePath } from "next/cache";
import { db, isForeignKeyViolation, toDbTime, type Role } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageBueroplan } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { dateKeyToUtcMidnight, parseDateKey } from "@/lib/zeit";
import {
  BUERO_ABWESENHEIT_LABELS,
  istGueltigesZeitfenster,
  kontingentFuerJahr,
  urlaubstageImJahr,
  type AbwesenheitBereich,
} from "./logik";
import { istBueroperson } from "./personen";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** UTC-Mitternacht eines Kalendertags als DB-Zeit (Konvention für reine Datumsfelder). */
function dbDatum(dateKey: string): string {
  return toDbTime(dateKeyToUtcMidnight(dateKey));
}

interface ActionUser {
  id: string;
  email: string;
  name: string;
  rollen: Role[];
}

async function requireBueroplaner(): Promise<{ actor: ActionUser } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
  if (!canManageBueroplan(rollen)) {
    return { failure: { error: "Die Dienst- & Urlaubsplanung ist Admin, Chef und Büro vorbehalten." } };
  }
  return {
    actor: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: `${ctx.user.firstName} ${ctx.user.lastName}`,
      rollen,
    },
  };
}

/** Person prüfen: existiert und führt ein BUERO/ADMIN/CHEF-Konto. */
async function pruefeZielPerson(personId: string): Promise<FormState | null> {
  const person = await db.orm.public.Person.where({ id: personId }).first();
  if (!person) return { error: "Person nicht gefunden." };
  if (!(await istBueroperson(personId))) {
    return { error: "Die Dienstplanung gilt nur für Personen mit Büro-Konto (BUERO, Admin oder Chef)." };
  }
  return null;
}

const ABWEICHUNG_ARTEN = ["ARBEITSZEIT", "FREI"] as const;
const ABWESENHEIT_ARTEN = ["URLAUB", "KRANKHEIT", "SONSTIGE"] as const;

/**
 * Warnhinweis, wenn der Urlaub das Jahreskontingent der betroffenen Jahre
 * überschreitet (keine harte Blockade — das Büro entscheidet).
 */
async function urlaubKontingentHinweis(personId: string, vonKey: string, bisKey: string): Promise<string> {
  const [abwesenheitenRows, kontingenteRows] = await Promise.all([
    db.orm.public.BueroAbwesenheit.where({ personId, art: "URLAUB" }).all(),
    db.orm.public.BueroUrlaubskontingent.where({ personId }).all(),
  ]);
  const bereiche: AbwesenheitBereich[] = abwesenheitenRows.map((a) => ({
    art: "URLAUB",
    vonKey: a.von.slice(0, 10),
    bisKey: a.bis.slice(0, 10),
    bemerkung: a.bemerkung,
  }));
  const ersteJahr = Number(vonKey.slice(0, 4));
  const letztesJahr = Number(bisKey.slice(0, 4));
  const hinweise: string[] = [];
  for (let jahr = ersteJahr; jahr <= letztesJahr; jahr++) {
    const genutzt = urlaubstageImJahr(bereiche, jahr);
    const kontingent = kontingentFuerJahr(kontingenteRows, jahr);
    if (genutzt > kontingent) {
      hinweise.push(`${genutzt} von ${kontingent} Tagen (${jahr})`);
    }
  }
  return hinweise.length > 0 ? ` Achtung: Urlaubs-Kontingent überschritten — ${hinweise.join(", ")}.` : "";
}

function revalidateBueroplan(personId?: string) {
  revalidatePath("/bueroplan");
  if (personId) revalidatePath(`/bueroplan/${personId}`);
}

// ——— Pensum (wiederkehrende Wochenplan-Blöcke) ————————————————————

export async function saveDienstAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const personId = str(formData, "personId");
  const wochentagRaw = Number.parseInt(str(formData, "wochentag"), 10);
  const startZeit = str(formData, "startZeit");
  const endZeit = str(formData, "endZeit");
  const notiz = str(formData, "notiz") || null;

  if (!personId) return { error: "Person fehlt." };
  const personenPruefung = await pruefeZielPerson(personId);
  if (personenPruefung) return personenPruefung;

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(wochentagRaw) || wochentagRaw < 1 || wochentagRaw > 7) {
    fieldErrors.wochentag = "Wochentag wählen";
  }
  if (!istGueltigesZeitfenster(startZeit, endZeit)) {
    fieldErrors.startZeit = "Zeitfenster prüfen: Start vor Ende (z.B. 08:00–12:00)";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const data = { personId, wochentag: wochentagRaw, startZeit, endZeit, notiz };
  try {
    if (id) {
      const existing = await db.orm.public.BueroDienst.where({ id }).first();
      if (!existing) return { error: "Dienst-Block nicht gefunden." };
      await db.orm.public.BueroDienst.where({ id }).update(data);
      await recordAudit({
        actor,
        action: "bueroplan.dienst_create",
        entity: "BueroDienst",
        entityId: id,
        summary: `Pensum-Block von ${existing.startZeit}–${existing.endZeit} geändert (${existing.personId})`,
        details: { ...data, vorher: { wochentag: existing.wochentag, startZeit: existing.startZeit, endZeit: existing.endZeit } },
      });
      revalidateBueroplan(personId);
      return { success: "Dienst-Block gespeichert." };
    }
    const created = await db.orm.public.BueroDienst.create(data);
    await recordAudit({
      actor,
      action: "bueroplan.dienst_create",
      entity: "BueroDienst",
      entityId: created.id,
      summary: `Pensum-Block erfasst: ${startZeit}–${endZeit} (Person ${personId})`,
      details: data,
    });
    revalidateBueroplan(personId);
    return { success: "Dienst-Block erfasst." };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Die verknüpfte Person wurde nicht gefunden." };
    }
    console.error("Dienst-Block speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function deleteDienstAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const dienst = await db.orm.public.BueroDienst.where({ id }).first();
  if (!dienst) return { error: "Dienst-Block nicht gefunden." };
  await db.orm.public.BueroDienst.where({ id }).delete();
  await recordAudit({
    actor,
    action: "bueroplan.dienst_delete",
    entity: "BueroDienst",
    entityId: id,
    summary: `Pensum-Block ${dienst.startZeit}–${dienst.endZeit} entfernt`,
    details: { personId: dienst.personId, wochentag: dienst.wochentag },
  });
  revalidateBueroplan(dienst.personId);
  return { success: "Dienst-Block entfernt." };
}

// ——— Tages-Abweichungen ————————————————————————————————————————————

export async function saveAbweichungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const personId = str(formData, "personId");
  const artRaw = str(formData, "art");
  const datumRaw = str(formData, "datum");
  const startZeit = str(formData, "startZeit");
  const endZeit = str(formData, "endZeit");
  const notiz = str(formData, "notiz") || null;

  if (!personId) return { error: "Person fehlt." };
  const personenPruefung = await pruefeZielPerson(personId);
  if (personenPruefung) return personenPruefung;

  const fieldErrors: Record<string, string> = {};
  if (!(ABWEICHUNG_ARTEN as readonly string[]).includes(artRaw)) {
    fieldErrors.art = "Art wählen";
  }
  if (!parseDateKey(datumRaw)) {
    fieldErrors.datum = "Datum angeben";
  }
  const art = artRaw as (typeof ABWEICHUNG_ARTEN)[number];
  let zeiten: { startZeit: string | null; endZeit: string | null } = { startZeit: null, endZeit: null };
  if (art === "ARBEITSZEIT") {
    if (!istGueltigesZeitfenster(startZeit, endZeit)) {
      fieldErrors.startZeit = "Zeitfenster prüfen: Start vor Ende";
    } else {
      zeiten = { startZeit, endZeit };
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const data = { personId, datum: dbDatum(datumRaw), art, ...zeiten, notiz };
  try {
    if (id) {
      const existing = await db.orm.public.BueroAbweichung.where({ id }).first();
      if (!existing) return { error: "Abweichung nicht gefunden." };
      await db.orm.public.BueroAbweichung.where({ id }).update(data);
      await recordAudit({
        actor,
        action: "bueroplan.abweichung_create",
        entity: "BueroAbweichung",
        entityId: id,
        summary: `Tages-Abweichung geändert (${datumRaw}, ${art})`,
        details: { ...data, datumKey: datumRaw, vorher: { art: existing.art, startZeit: existing.startZeit, endZeit: existing.endZeit } },
      });
      revalidateBueroplan(personId);
      return { success: "Abweichung gespeichert." };
    }
    const createdAbweichung = await db.orm.public.BueroAbweichung.create(data);
    await recordAudit({
      actor,
      action: "bueroplan.abweichung_create",
      entity: "BueroAbweichung",
      entityId: createdAbweichung.id,
      summary: `Tages-Abweichung erfasst: ${datumRaw} (${art})`,
      details: { ...data, datumKey: datumRaw },
    });
    revalidateBueroplan(personId);
    return { success: "Abweichung erfasst." };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Die verknüpfte Person wurde nicht gefunden." };
    }
    console.error("Abweichung speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function deleteAbweichungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const abweichung = await db.orm.public.BueroAbweichung.where({ id }).first();
  if (!abweichung) return { error: "Abweichung nicht gefunden." };
  await db.orm.public.BueroAbweichung.where({ id }).delete();
  await recordAudit({
    actor,
    action: "bueroplan.abweichung_delete",
    entity: "BueroAbweichung",
    entityId: id,
    summary: `Tages-Abweichung entfernt`,
    details: { personId: abweichung.personId, datum: abweichung.datum, art: abweichung.art },
  });
  revalidateBueroplan(abweichung.personId);
  return { success: "Abweichung entfernt." };
}

// ——— Abwesenheiten (Urlaub/Krankheit/sonstige) —————————————————————

export async function saveAbwesenheitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const personId = str(formData, "personId");
  const artRaw = str(formData, "art");
  const vonRaw = str(formData, "von");
  const bisRaw = str(formData, "bis");
  const bemerkung = str(formData, "bemerkung") || null;

  if (!personId) return { error: "Person fehlt." };
  const personenPruefung = await pruefeZielPerson(personId);
  if (personenPruefung) return personenPruefung;

  const fieldErrors: Record<string, string> = {};
  if (!(ABWESENHEIT_ARTEN as readonly string[]).includes(artRaw)) {
    fieldErrors.art = "Art wählen";
  }
  if (!parseDateKey(vonRaw)) fieldErrors.von = "Von-Datum angeben";
  if (!parseDateKey(bisRaw)) fieldErrors.bis = "Bis-Datum angeben";
  if (parseDateKey(vonRaw) && parseDateKey(bisRaw) && bisRaw < vonRaw) {
    fieldErrors.bis = "Das Bis-Datum liegt vor dem Von-Datum.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const data = { personId, art: artRaw as (typeof ABWESENHEIT_ARTEN)[number], von: dbDatum(vonRaw), bis: dbDatum(bisRaw), bemerkung };
  try {
    if (id) {
      const existing = await db.orm.public.BueroAbwesenheit.where({ id }).first();
      if (!existing) return { error: "Abwesenheit nicht gefunden." };
      await db.orm.public.BueroAbwesenheit.where({ id }).update(data);
      await recordAudit({
        actor,
        action: "bueroplan.abwesenheit_create",
        entity: "BueroAbwesenheit",
        entityId: id,
        summary: `Abwesenheit geändert: ${BUERO_ABWESENHEIT_LABELS[data.art]} ${vonRaw}–${bisRaw}`,
        details: { ...data, datumVon: vonRaw, datumBis: bisRaw },
      });
      revalidateBueroplan(personId);
      return { success: "Abwesenheit gespeichert." };
    }
    const createdAbwesenheit = await db.orm.public.BueroAbwesenheit.create(data);
    await recordAudit({
      actor,
      action: "bueroplan.abwesenheit_create",
      entity: "BueroAbwesenheit",
      entityId: createdAbwesenheit.id,
      summary: `Abwesenheit erfasst: ${BUERO_ABWESENHEIT_LABELS[data.art]} ${vonRaw}–${bisRaw}`,
      details: { ...data, datumVon: vonRaw, datumBis: bisRaw },
    });
    revalidateBueroplan(personId);
    const hinweis = data.art === "URLAUB" ? await urlaubKontingentHinweis(personId, vonRaw, bisRaw) : "";
    return { success: `Abwesenheit erfasst.${hinweis}` };
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Die verknüpfte Person wurde nicht gefunden." };
    }
    console.error("Abwesenheit speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function deleteAbwesenheitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const abwesenheit = await db.orm.public.BueroAbwesenheit.where({ id }).first();
  if (!abwesenheit) return { error: "Abwesenheit nicht gefunden." };
  await db.orm.public.BueroAbwesenheit.where({ id }).delete();
  await recordAudit({
    actor,
    action: "bueroplan.abwesenheit_delete",
    entity: "BueroAbwesenheit",
    entityId: id,
    summary: `Abwesenheit entfernt (${abwesenheit.art})`,
    details: { personId: abwesenheit.personId, von: abwesenheit.von, bis: abwesenheit.bis },
  });
  revalidateBueroplan(abwesenheit.personId);
  return { success: "Abwesenheit entfernt." };
}

// ——— Urlaubskontingent (anpassbar) ——————————————————————————————————

export async function saveKontingentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBueroplaner();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const personId = str(formData, "personId");
  const jahrRaw = Number.parseInt(str(formData, "jahr"), 10);
  const tageRaw = Number.parseInt(str(formData, "tage"), 10);

  if (!personId) return { error: "Person fehlt." };
  const personenPruefung = await pruefeZielPerson(personId);
  if (personenPruefung) return personenPruefung;

  const fieldErrors: Record<string, string> = {};
  if (!Number.isInteger(jahrRaw) || jahrRaw < 2000 || jahrRaw > 2100) {
    fieldErrors.jahr = "Jahr angeben (z.B. 2026)";
  }
  if (!Number.isInteger(tageRaw) || tageRaw < 0 || tageRaw > 365) {
    fieldErrors.tage = "Tage zwischen 0 und 365";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  try {
    // Erst lesen, dann ändern oder anlegen (composite key personId+jahr).
    const existing = await db.orm.public.BueroUrlaubskontingent.where({ personId, jahr: jahrRaw }).first();
    if (existing) {
      await db.orm.public.BueroUrlaubskontingent.where({ id: existing.id }).update({ tage: tageRaw });
    } else {
      await db.orm.public.BueroUrlaubskontingent.create({ personId, jahr: jahrRaw, tage: tageRaw });
    }
  } catch (error) {
    console.error("Kontingent speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
  await recordAudit({
    actor,
    action: "bueroplan.kontingent_upsert",
    entity: "BueroUrlaubskontingent",
    entityId: personId,
    summary: `Urlaubs-Kontingent ${jahrRaw}: ${tageRaw} Tage`,
    details: { personId, jahr: jahrRaw, tage: tageRaw },
  });
  revalidateBueroplan(personId);
  return { success: `Urlaubs-Kontingent ${jahrRaw}: ${tageRaw} Tage gespeichert.` };
}
