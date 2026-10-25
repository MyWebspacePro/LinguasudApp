// Paket- & Guthaben-Logik der Anmeldungen (Modul 5, pure):
// - Guthaben = Summe der Journal-Deltas (Konto mit Journal)
// - Paketfortschritt = Verbrauch seit paketStartAt (Verbrauch/Fehlzeiten)
// - Paketende-Automatik: nach der 12. von 14 / 13. von 15 Lektion
// - Tarif-Standard nach Tageszeit (übersteuerbar)

import type { JournalArt } from "@/lib/db";
import { isHochtarifZeit, timeToMinutes, type Tarifzeitfenster } from "@/lib/stammdaten/tarif";
import { dateKeyOf } from "@/lib/zeit";

/** Kalendertag (Schul-Zeitzone) eines Journal-Datums; akzeptiert DB-Rohformat ("2026-10-24 13:56:12.345") und ISO. */
function datumKey(s: string): string {
  const normalized = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  return dateKeyOf(new Date(normalized));
}

export interface JournalEintrag {
  art: JournalArt;
  delta: number;
  /** UTC-Instant der Buchung (ISO oder DB-Rohformat — nur Vergleiche). */
  datum: string;
}

/** Ab wie vielen verbrauchten Lektionen die Automatik meldet (2 vor Paketende). */
export const PAKETENDE_REST_LEKTIONEN = 2;

/** Guthaben-Stand = Summe aller Journal-Deltas (positiv = Lektionen offen). */
export function guthabenStand(journal: readonly JournalEintrag[]): number {
  return journal.reduce((summe, e) => summe + e.delta, 0);
}

const VERBRAUCHSARTEN: readonly JournalArt[] = ["VERBRAUCH", "FEHLZEIT_UNENTSCHULDIGT"];

/**
 * Verbrauchte Lektionen im laufenden Paket: Verbrauch- und unentschuldigte
 * Fehlzeit-Einträge seit paketStartAt — tag-genau (Fehlzeiten sind reine
 * Kalendertage; entschuldigte Fehlzeiten zählen −0 und erscheinen deshalb
 * nicht im Fortschritt).
 */
export function verbrauchtImPaket(journal: readonly JournalEintrag[], paketStartAtISO: string): number {
  const startKey = datumKey(paketStartAtISO);
  return journal.filter((e) => VERBRAUCHSARTEN.includes(e.art) && datumKey(e.datum) >= startKey).length;
}

/** Automatik-Schwelle: 12. von 14 / 13. von 15 (allgemein paketGroesse − 2). */
export function paketendeSchwelle(paketGroesse: number): number {
  return Math.max(0, paketGroesse - PAKETENDE_REST_LEKTIONEN);
}

/** Ist die Paketende-Automatik ausgelöst? */
export function paketendeErreicht(verbraucht: number, paketGroesse: number): boolean {
  return verbraucht >= paketendeSchwelle(paketGroesse);
}

/** Fortschritt für die Anzeige (0–1, geklemmt). */
export function paketFortschritt(verbraucht: number, paketGroesse: number): number {
  if (paketGroesse <= 0) return 0;
  return Math.min(1, verbraucht / paketGroesse);
}

// ——— Tarif-Standard nach Tageszeit ————————————————————————————————

export interface TarifstufeOption extends Tarifzeitfenster {
  id: string;
  name: string;
  lessonsPerPackage: number;
}

/**
 * Standard-Tarifstufe für einen Kursstart nach Tageszeit: die erste Stufe
 * deren Hochtarif-Fenster (Mittag/Abend) den Start enthält; sonst die erste
 * Stufe ohne Fenster (Niedertarif). Das Büro kann im Formular übersteuern.
 */
export function autoTarifstufe(startZeit: string, tarifstufen: readonly TarifstufeOption[]): TarifstufeOption | null {
  const start = timeToMinutes(startZeit);
  if (start !== null) {
    const hoch = tarifstufen.find((t) => isHochtarifZeit(start, t));
    if (hoch) return hoch;
  }
  return tarifstufen.find((t) => t.middayFrom === null && t.middayTo === null && t.eveningFrom === null) ?? tarifstufen[0] ?? null;
}
