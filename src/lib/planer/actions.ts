"use server";

// Planer-Server-Actions (Modul 6): Lektionen verschieben, fixieren, absagen
// und die Generierung manuell anstossen. Verschieben/fixieren/verteilen darf
// ausschliesslich das Büro (Admin/Chef/Büro). Keine harte Konfliktblockade —
// Konflikte sind rein farblich. Fixierung mit Raum-/Zeitänderung informiert
// die Teilnehmenden.

import { revalidatePath } from "next/cache";
import { db, fromDbTime, toDbTime, type Role } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManagePlaner, hasRole } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { normalizeTimeInput } from "@/lib/stammdaten/tarif";
import { formatDatumKurz, parseDateKey, timeFromMinutes, utcToZoned, weekdayOfDateKey, zonedTimeToUtc } from "@/lib/zeit";
import { generiereLektionen } from "@/lib/kurse/lektionsgenerierung";
import { informiereKursteilnehmende } from "@/lib/kurse/benachrichtigung";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requirePlanerManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
  if (!canManagePlaner(rollen)) {
    return { failure: { error: "Lektionen verschieben und fixieren ist dem Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidatePlaner(...paths: string[]) {
  revalidatePath("/planer");
  revalidatePath("/kurse");
  for (const p of paths) revalidatePath(p);
}

/** Lesbare Terminbeschreibung ("Di, 27.10. · 18:00–19:00 · Raum Oxford"). */
async function terminBeschreibung(lektion: { startAt: string; dauerMinuten: number; raumId: string | null }): Promise<string> {
  const local = utcToZoned(fromDbTime(lektion.startAt));
  const ende = timeFromMinutes(local.minuteOfDay + lektion.dauerMinuten);
  let raum = "ohne Raum";
  if (lektion.raumId) {
    const r = await db.orm.public.Raum.where({ id: lektion.raumId }).include("etage").first();
    raum = r ? `Raum ${r.name}` : "Raum (entfernt)";
  }
  return `${formatDatumKurz(local.dateKey)} · ${timeFromMinutes(local.minuteOfDay)}–${ende} · ${raum}`;
}

// ——— Generierung manuell anstossen ————————————————————————————————

export async function generiereLektionenAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const guard = await requirePlanerManager();
  if ("failure" in guard) return guard.failure;

  try {
    const result = await generiereLektionen();
    await recordAudit({
      actor: guard.actor,
      action: "planer.generieren",
      summary: `Lektionsgenerierung manuell: ${result.erstellt} Lektionen für ${result.kurse} Kurse (bis ${result.horizonBis})`,
      details: { erstellt: result.erstellt, kurse: result.kurse, horizonBis: result.horizonBis },
    });
    revalidatePlaner();
    if (result.erstellt === 0) {
      return { success: "Keine neuen Lektionen nötig — der Horizont ist vollständig." };
    }
    return { success: `${result.erstellt} Lektionen für ${result.kurse} Kurse erzeugt (bis ${result.horizonBis}).` };
  } catch (error) {
    console.error("Lektionsgenerierung fehlgeschlagen:", error);
    return { error: "Lektionsgenerierung fehlgeschlagen." };
  }
}

// ——— Lektion verschieben ——————————————————————————————————————————

export async function verschiebeLektionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requirePlanerManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const lektionId = str(formData, "lektionId");
  const datumRaw = str(formData, "datum");
  const zeitRaw = normalizeTimeInput(str(formData, "zeit"));
  const raumRaw = str(formData, "raumId") || null;

  if (!parseDateKey(datumRaw)) return { error: "Bitte ein gültiges Datum angeben.", fieldErrors: { datum: "TT.MM.JJJJ" } };
  if (!zeitRaw) return { error: "Bitte eine gültige Startzeit angeben.", fieldErrors: { zeit: "HH:mm" } };
  if (weekdayOfDateKey(datumRaw) === 7) {
    return { error: "Sonntags findet kein Unterricht statt (Planer Mo–Sa)." };
  }

  const lektion = await db.orm.public.Lektion
    .where({ id: lektionId })
    .include("kurs")
    .first();
  if (!lektion) return { error: "Lektion nicht gefunden." };

  const startAt = zonedTimeToUtc(datumRaw, zeitRaw);
  if (Number.isNaN(startAt.getTime())) return { error: "Ungültiger Termin." };

  const bestehend = await terminBeschreibung(lektion);
  const vorherStatus = lektion.status;
  const geaendert =
    lektion.startAt !== toDbTime(startAt) || (lektion.raumId ?? null) !== raumRaw;

  await db.orm.public.Lektion.where({ id: lektionId }).update({
    startAt: toDbTime(startAt),
    raumId: raumRaw,
    quelle: "MANUELL",
    // Verschieben ist provisorisch: eine fixierte Lektion muss neu fixiert werden.
    status: "PROVISORISCH",
    fixiertAt: null,
  });

  const neu = await terminBeschreibung({
    startAt: toDbTime(startAt),
    dauerMinuten: lektion.dauerMinuten,
    raumId: raumRaw,
  });

  await recordAudit({
    actor,
    action: "planer.verschieben",
    entity: "lektion",
    entityId: lektionId,
    summary: `Lektion von «${lektion.kurs.code}» verschoben: ${bestehend} → ${neu}${vorherStatus === "FIXIERT" ? " (war fixiert, muss neu fixiert werden)" : ""}`,
    details: { kursId: lektion.kursId, datum: datumRaw, zeit: zeitRaw, raumId: raumRaw },
  });
  revalidatePlaner(`/kurse/${lektion.kursId}`);

  if (!geaendert) {
    return { success: "Lektion gespeichert (Termin unverändert)." };
  }
  return {
    success:
      "Lektion verschoben (provisorisch). Fixieren informiert die Teilnehmenden, sofern sich Zeit oder Raum geändert haben.",
  };
}

// ——— Lektion fixieren ——————————————————————————————————————————————

export async function fixiereLektionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requirePlanerManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const lektionId = str(formData, "lektionId");
  const lektion = await db.orm.public.Lektion
    .where({ id: lektionId })
    .include("kurs")
    .first();
  if (!lektion) return { error: "Lektion nicht gefunden." };
  if (lektion.status === "ABGESAGT") {
    return { error: "Die Lektion ist abgesagt und kann nicht fixiert werden." };
  }

  await db.orm.public.Lektion.where({ id: lektionId }).update({ status: "FIXIERT", fixiertAt: toDbTime(new Date()) });

  // Bei Fixierung, die vom üblichen Wochentermin abweicht (Ausnahmezeit oder
  // manuell verschoben), werden die Teilnehmenden informiert (Pflichtenheft Modul 6).
  let hinweis = "Lektion fixiert.";
  const kurs = lektion.kurs;
  const weichtAb =
    kurs.wochentag !== null && kurs.startZeit !== null
      ? (() => {
          const local = utcToZoned(fromDbTime(lektion.startAt));
          return (
            local.minuteOfDay !== Number(kurs.startZeit!.slice(0, 2)) * 60 + Number(kurs.startZeit!.slice(3, 5)) ||
            weekdayOfDateKey(local.dateKey) !== kurs.wochentag
          );
        })()
      : true;
  const movedManually = lektion.quelle === "MANUELL";

  if (weichtAb || movedManually) {
    const benachrichtigung = await informiereKursteilnehmende({
      kursId: kurs.id,
      kursCode: kurs.code,
      betreff: `Terminänderung: ${kurs.code}`,
      intro: "der Termin für Ihre nächste Lektion wurde festgelegt und weicht vom üblichen Wochentermin ab:",
      bestehend: null,
      neu: await terminBeschreibung(lektion),
    });
    hinweis =
      `Lektion fixiert. ${benachrichtigung.gesendet} Teilnehmende informiert` +
      (benachrichtigung.ohneEmail > 0 ? `, ${benachrichtigung.ohneEmail} ohne E-Mail (bitte telefonisch benachrichtigen).` : ".");
  }

  await recordAudit({
    actor,
    action: "planer.fixieren",
    entity: "lektion",
    entityId: lektionId,
    summary: `Lektion von «${kurs.code}» fixiert (${await terminBeschreibung(lektion)})`,
    details: { kursId: kurs.id, informiert: hinweis },
  });
  revalidatePlaner(`/kurse/${kurs.id}`);
  return { success: hinweis };
}

// ——— Lektion absagen (Büro oder Lehrperson der eigenen Lektion) ———————

/**
 * Wächter der Absage: Büro überall; Lehrpersonen dürfen ihre eigenen
 * Lektionen selbst absagen (Pflichtenheft Modul 7) — mit Grund, Teilnehmende
 * werden informiert, kein Guthaben-Abzug.
 */
async function requireAbsageZugriff(
  lektionId: string,
): Promise<{ actor: { id: string; email: string; name: string }; alsLehrperson: boolean } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
  const actor = { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` };
  if (canManagePlaner(rollen)) return { actor, alsLehrperson: false };
  if (!hasRole(rollen, "LEHRPERSON") || !ctx.user.personId) {
    return { failure: { error: "Lektionen absagen dürfen nur das Büro oder die Lehrperson der Lektion." } };
  }
  const lektion = await db.orm.public.Lektion.where({ id: lektionId }).first();
  if (!lektion) return { failure: { error: "Lektion nicht gefunden." } };
  if (lektion.lehrpersonId !== ctx.user.personId) {
    return { failure: { error: "Sie können nur Ihre eigenen Lektionen absagen." } };
  }
  return { actor, alsLehrperson: true };
}

export async function sageLektionAbAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const lektionId = str(formData, "lektionId");
  const zugriff = await requireAbsageZugriff(lektionId);
  if ("failure" in zugriff) return zugriff.failure;
  const actor = zugriff.actor;

  const grund = str(formData, "grund");
  if (!grund) return { error: "Bitte einen Absage-Grund angeben.", fieldErrors: { grund: "Pflichtfeld" } };
  const lektion = await db.orm.public.Lektion
    .where({ id: lektionId })
    .include("kurs")
    .first();
  if (!lektion) return { error: "Lektion nicht gefunden." };
  if (lektion.status === "ABGESAGT") return { error: "Die Lektion ist bereits abgesagt." };

  await db.orm.public.Lektion.where({ id: lektionId }).update({ status: "ABGESAGT", notiz: grund });

  const benachrichtigung = await informiereKursteilnehmende({
    kursId: lektion.kursId,
    kursCode: lektion.kurs.code,
    betreff: `Lektion abgesagt: ${lektion.kurs.code}`,
    intro: "die folgende Lektion wurde abgesagt (kein Guthaben-Abzug):",
    bestehend: await terminBeschreibung(lektion),
    neu: `Grund: ${grund}`,
  });

  await recordAudit({
    actor,
    action: zugriff.alsLehrperson ? "planer.absagen_lehrperson" : "planer.absagen",
    entity: "lektion",
    entityId: lektionId,
    summary: `Lektion von «${lektion.kurs.code}» abgesagt${zugriff.alsLehrperson ? " durch die Lehrperson" : ""} (${await terminBeschreibung(lektion)}) — Grund: ${grund}`,
    details: { kursId: lektion.kursId, grund, informiert: { ...benachrichtigung } },
  });
  revalidatePlaner(`/kurse/${lektion.kursId}`);
  return { success: `Lektion abgesagt. ${benachrichtigung.gesendet} Teilnehmende informiert.` };
}
