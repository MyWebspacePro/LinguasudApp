"use server";

// Honorar-Server-Actions (Modul 11): Default-Stundensatz (Stammdaten — nur
// Admin), Honorar-Matrix pflegen (Abweichungen pro Lehrperson), Monats-
// Workflow «als bezahlt markieren» / wieder öffnen. Rechte: Büro-Operativ
// (Muster canManageAnmeldungen); alles im Audit-Log.

import { revalidatePath } from "next/cache";
import { db, isUniqueViolation, toDbTime } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageHonorare, canManageStammdaten } from "@/lib/auth/permissions";
import { roleList } from "@/lib/domain";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { formatChf, istMonatKey } from "./logik";
import { speichereDefaultStundensatz } from "./abrechnung";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireHonorarManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageHonorare(roleList(ctx.user.roles))) {
    return { failure: { error: "Die Honorarabrechnung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

// ——— Globaler Default-Stundensatz (Stammdaten: nur Admin) ————————————

export async function speichereDefaultStundensatzAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." };
  if (ctx.user.mustChangePassword) return { error: "Bitte ändern Sie zuerst Ihr Passwort." };
  if (!canManageStammdaten(roleList(ctx.user.roles))) {
    return { error: "Den Default-Stundensatz pflegt ausschliesslich der Admin (Stammdaten)." };
  }
  const actor = { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` };

  const raw = str(formData, "stundensatz").replace(",", ".");
  const stundensatz = Number(raw);
  if (!Number.isFinite(stundensatz) || stundensatz <= 0 || stundensatz > 1000) {
    return { error: "Bitte einen Stundensatz in CHF angeben (z.B. 40.00).", fieldErrors: { stundensatz: "Ungültiger Betrag" } };
  }

  try {
    await speichereDefaultStundensatz(stundensatz);
    await recordAudit({
      actor,
      action: "honorar.default_satz",
      entity: "systemsetting",
      entityId: "honorar.defaultStundensatz",
      summary: `Globaler Default-Stundensatz auf CHF ${formatChf(stundensatz)} gesetzt`,
    });
    revalidatePath("/honorare");
    revalidatePath("/honorare/saetze");
    return { success: `Default-Stundensatz gespeichert: CHF ${formatChf(stundensatz)} / Stunde.` };
  } catch (error) {
    console.error("Default-Stundensatz speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

// ——— Honorar-Matrix (Abweichungen pro Lehrperson) ————————————————————

export async function saveHonorarSatzAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireHonorarManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const lehrpersonId = str(formData, "lehrpersonId");
  const kursartId = str(formData, "kursartId");
  const minutenRaw = Number.parseInt(str(formData, "minuten"), 10);
  const stundensatzRaw = str(formData, "stundensatz").replace(",", ".");

  const fieldErrors: Record<string, string> = {};
  if (!lehrpersonId) fieldErrors.lehrpersonId = "Lehrperson wählen";
  if (!kursartId) fieldErrors.kursartId = "Kursart wählen";
  if (!Number.isInteger(minutenRaw) || minutenRaw < 15 || minutenRaw > 480) {
    fieldErrors.minuten = "Dauer in Minuten (z.B. 45, 60, 90)";
  }
  const stundensatz = Number(stundensatzRaw);
  if (!Number.isFinite(stundensatz) || stundensatz <= 0 || stundensatz > 1000) {
    fieldErrors.stundensatz = "Stundensatz in CHF (z.B. 45.00)";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const lehrperson = await db.orm.public.Person.where({ id: lehrpersonId }).first();
  if (!lehrperson?.istLehrperson) return { error: "Die gewählte Person ist keine Lehrperson." };
  const kursart = await db.orm.public.Kursart.where({ id: kursartId }).first();
  if (!kursart) return { error: "Kursart nicht gefunden." };

  try {
    const bestehend = await db.orm.public.HonorarSatz
      .where({ lehrpersonId, kursartId, minuten: minutenRaw })
      .first();
    if (bestehend) {
      await db.orm.public.HonorarSatz.where({ id: bestehend.id }).update({
        stundensatzChf: stundensatz.toFixed(2),
      });
      await recordAudit({
        actor,
        action: "honorar.satz_update",
        entity: "honorarsatz",
        entityId: bestehend.id,
        summary: `Honorar-Satz ${lehrperson.vorname} ${lehrperson.nachname} · ${kursart.name} · ${minutenRaw} Min auf CHF ${formatChf(stundensatz)}/h geändert`,
      });
    } else {
      await db.orm.public.HonorarSatz.create({
        lehrpersonId,
        kursartId,
        minuten: minutenRaw,
        stundensatzChf: stundensatz.toFixed(2),
      });
      await recordAudit({
        actor,
        action: "honorar.satz_create",
        entity: "honorarsatz",
        entityId: `${lehrpersonId}:${kursartId}:${minutenRaw}`,
        summary: `Honorar-Satz ${lehrperson.vorname} ${lehrperson.nachname} · ${kursart.name} · ${minutenRaw} Min auf CHF ${formatChf(stundensatz)}/h gesetzt`,
      });
    }
    revalidatePath("/honorare");
    revalidatePath("/honorare/saetze");
    return {
      success: `Satz gespeichert: ${lehrperson.vorname} ${lehrperson.nachname} · ${kursart.name} · ${minutenRaw} Min = CHF ${formatChf(stundensatz)}/h.`,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Für diese Kombination (Lehrperson × Kursart × Dauer) existiert bereits ein Satz." };
    }
    console.error("Honorar-Satz speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function loescheHonorarSatzAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireHonorarManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const satzId = str(formData, "satzId");
  const satz = await db.orm.public.HonorarSatz.where({ id: satzId }).first();
  if (!satz) return { error: "Honorar-Satz nicht gefunden." };

  await db.orm.public.HonorarSatz.where({ id: satzId }).delete();
  await recordAudit({
    actor,
    action: "honorar.satz_delete",
    entity: "honorarsatz",
    entityId: satzId,
    summary: `Honorar-Satz entfernt (Lehrperson ${satz.lehrpersonId}, Kursart ${satz.kursartId}, ${satz.minuten} Min, CHF ${formatChf(Number(satz.stundensatzChf.toString()))}/h)`,
  });
  revalidatePath("/honorare");
  revalidatePath("/honorare/saetze");
  return { success: "Honorar-Satz gelöscht — es gilt wieder der Default." };
}

// ——— Monats-Workflow: als bezahlt markieren / wieder öffnen ———————————

export async function markiereHonorarBezahltAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireHonorarManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const lehrpersonId = str(formData, "lehrpersonId");
  const monat = str(formData, "monat");
  const totalRaw = str(formData, "total");
  const anzahlRaw = Number.parseInt(str(formData, "anzahl"), 10);
  if (!istMonatKey(monat)) return { error: "Ungültiger Monat." };

  const lehrperson = await db.orm.public.Person.where({ id: lehrpersonId }).first();
  if (!lehrperson?.istLehrperson) return { error: "Lehrperson nicht gefunden." };

  const total = Number(totalRaw);
  if (!Number.isFinite(total) || total < 0) {
    return { error: "Ungültiger Totalbetrag — bitte die Seite neu laden." };
  }

  const bestehend = await db.orm.public.HonorarAbrechnung
    .where({ lehrpersonId, monat })
    .first();
  const snapshot = {
    status: "BEZAHLT" as const,
    lektionenAnzahl: Number.isInteger(anzahlRaw) ? anzahlRaw : 0,
    totalChf: total.toFixed(2),
    bezahltAt: toDbTime(new Date()),
    actorUserId: actor.id,
    actorName: actor.name,
  };
  if (bestehend) {
    await db.orm.public.HonorarAbrechnung.where({ id: bestehend.id }).update(snapshot);
  } else {
    await db.orm.public.HonorarAbrechnung.create({ lehrpersonId, monat, ...snapshot });
  }

  await recordAudit({
    actor,
    action: "honorar.bezahlt",
    entity: "honorarabrechnung",
    entityId: `${lehrpersonId}:${monat}`,
    summary: `Honorar ${lehrperson.vorname} ${lehrperson.nachname} · ${monat} als bezahlt markiert (CHF ${formatChf(total)}, ${snapshot.lektionenAnzahl} Lektionen)`,
  });
  revalidatePath("/honorare");
  revalidatePath("/dashboard");
  return { success: `Honorar von ${lehrperson.vorname} ${lehrperson.nachname} für ${monat} als bezahlt markiert (CHF ${formatChf(total)}).` };
}

export async function oeffneHonorarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireHonorarManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const lehrpersonId = str(formData, "lehrpersonId");
  const monat = str(formData, "monat");
  if (!istMonatKey(monat)) return { error: "Ungültiger Monat." };

  const bestehend = await db.orm.public.HonorarAbrechnung
    .where({ lehrpersonId, monat })
    .first();
  if (!bestehend) return { error: "Keine Abrechnung für diesen Monat vorhanden." };

  await db.orm.public.HonorarAbrechnung.where({ id: bestehend.id }).update({
    status: "OFFEN",
    bezahltAt: null,
  });
  await recordAudit({
    actor,
    action: "honorar.wieder_geoeffnet",
    entity: "honorarabrechnung",
    entityId: `${lehrpersonId}:${monat}`,
    summary: `Honorar-Abrechnung ${monat} wieder geöffnet (vorher bezahlt, CHF ${formatChf(Number(bestehend.totalChf.toString()))})`,
  });
  revalidatePath("/honorare");
  revalidatePath("/dashboard");
  return { success: `Abrechnung für ${monat} wieder geöffnet.` };
}
