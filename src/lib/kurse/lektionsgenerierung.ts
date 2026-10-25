import "server-only";

// Rollierende Lektionsgenerierung (Modul 6): erzeugt für alle aktiven Kurse
// mit Wochentermin die Lektionen der nächsten zwei Wochen (idempotent —
// bestehende Termine bleiben unberührt). Läuft nächtlich (lektionsjob.ts)
// und manuell per Planer-Button.

import { db, toDbTime } from "@/lib/db";
import { geplanteTermine, horizonVonBis, type UnterbrechungsZeitraum } from "./lektionsplan";
import { addDays, dateKeyOf, heuteDateKey } from "@/lib/zeit";

const MARKER_KEY = "lektionen.generiertAm";

export interface GenerierungsResultat {
  erstellt: number;
  kurse: number;
  horizonBis: string;
}

/**
 * Erzeugt fehlende Lektionen im 14-Tage-Horizont. Für jeden aktiven Kurs mit
 * Wochentermin werden die Termine expandiert; Termine in Unterbrechungen
 * sowie bereits existierende Lektionen werden übersprungen. Externe
 * Firmenkurse erscheinen nicht im Planer — ihre Lektionen werden trotzdem
 * erzeugt (für Anwesenheit/Honorare), nur ohne Raum.
 */
export async function generiereLektionen(heuteKey: string = heuteDateKey()): Promise<GenerierungsResultat> {
  const { vonKey, bisKey } = horizonVonBis(heuteKey);

  const kurse = await db.orm.public.Kurs
    .where({ status: "AKTIV" })
    .include("unterbrechungen")
    .all();

  let erstellt = 0;
  let kursMitTerminen = 0;

  for (const kurs of kurse) {
    if (!kurs.wochentag || !kurs.startZeit || !kurs.dauerMinuten) continue;

    const unterbrechungen: UnterbrechungsZeitraum[] = kurs.unterbrechungen.map((u) => ({
      vonKey: dateKeyOf(new Date(u.von)),
      bisKey: dateKeyOf(new Date(u.bis)),
    }));
    const termine = geplanteTermine(
      { wochentag: kurs.wochentag, startZeit: kurs.startZeit, dauerMinuten: kurs.dauerMinuten },
      vonKey,
      bisKey,
      unterbrechungen,
    );
    if (termine.length === 0) continue;

    // Bestehende Termine des Kurses im Horizont (idempotent halten).
    const vorhandene = await db.orm.public.Lektion
      .where({ kursId: kurs.id })
      .where((l) => l.startAt.gte(toDbTime(new Date(`${vonKey}T00:00:00Z`))))
      .where((l) => l.startAt.lte(toDbTime(new Date(`${addDays(bisKey, 1)}T00:00:00Z`))))
      .select("startAt")
      .all();
    const vorhandenSet = new Set(vorhandene.map((l) => new Date(l.startAt).toISOString()));

    for (const termin of termine) {
      if (vorhandenSet.has(termin.startUtcISO)) continue;
      await db.orm.public.Lektion.create({
        kursId: kurs.id,
        lehrpersonId: kurs.lehrpersonId,
        startAt: termin.startUtcISO,
        dauerMinuten: termin.dauerMinuten,
        raumId: kurs.extern ? null : kurs.standardRaumId,
        status: "PROVISORISCH",
        quelle: "GENERIERT",
      });
      erstellt++;
    }
    kursMitTerminen++;
  }

  return { erstellt, kurse: kursMitTerminen, horizonBis: bisKey };
}

/**
 * Nächtlicher Marker: liefert true, wenn heute (Schul-Zeitzone) noch nicht
 * generiert wurde. Der Marker wird vor dem Lauf gesetzt, damit ein Fehler
 * im Lauf beim nächsten Tick wiederholt wird.
 */
export async function istHeuteNochNichtGeneriert(heuteKey: string = heuteDateKey()): Promise<boolean> {
  const marker = await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).first();
  return marker?.value !== heuteKey;
}

export async function markiereGenerierung(heuteKey: string = heuteDateKey()): Promise<void> {
  const marker = await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).first();
  if (marker) {
    await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).update({ value: heuteKey });
  } else {
    await db.orm.public.SystemSetting.create({ key: MARKER_KEY, value: heuteKey });
  }
}

/**
 * Nächtlicher Job-Aufruf: generiert nur, wenn heute noch nicht generiert
 * wurde (Marker + Datum in der Schul-Zeitzone).
 */
export async function naechtlicherLauf(): Promise<void> {
  const heuteKey = heuteDateKey();
  if (!(await istHeuteNochNichtGeneriert(heuteKey))) return;
  await markiereGenerierung(heuteKey);
  const result = await generiereLektionen(heuteKey);
  console.log(
    `Lektionsgenerierung: ${result.erstellt} Lektionen für ${result.kurse} Kurse erzeugt (Horizont bis ${result.horizonBis}).`,
  );
}
