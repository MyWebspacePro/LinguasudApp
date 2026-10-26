// Raumvermietung (Modul 12) — reine Logik ohne DB-Zugriff: Zeitfenster,
// Serien-Expansion (Wochentermine im Zeitraum, DST-unabhängig, da auf
// Kalender-Date-Keys gerechnet), Positionstext der Vermietungs-Rechnung und
// die Überschneidungs-Prüfung für den weichen Belegungshinweis.

import { formatDatum, parseDateKeyStrict, weekdayOfDateKey } from "@/lib/zeit";

/** Planer-/Vermietungs-Fenster (Lokalzeit): Start- und Endgrenze. */
export const VERMIETUNG_VON = "06:30";
export const VERMIETUNG_BIS = "23:00";

function minutenVon(zeit: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(zeit);
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min <= 24 * 60 ? min : null;
}

/**
 * Dauer eines Zeitfensters in Minuten; null bei ungültigen/umgekehrten
 * Zeiten (Ende muss nach dem Start liegen).
 */
export function dauerMinutenAusZeitfenster(startZeit: string, endZeit: string): number | null {
  const von = minutenVon(startZeit);
  const bis = minutenVon(endZeit);
  if (von === null || bis === null) return null;
  const dauer = bis - von;
  return dauer > 0 ? dauer : null;
}

/** Liegt das Fenster komplett im Planer-Raster (06:30–23:00)? */
export function istImPlanerFenster(startZeit: string, endZeit: string): boolean {
  const von = minutenVon(startZeit);
  const bis = minutenVon(endZeit);
  if (von === null || bis === null) return false;
  const startGrenze = minutenVon(VERMIETUNG_VON)!;
  const endeGrenze = minutenVon(VERMIETUNG_BIS)!;
  return von >= startGrenze && bis <= endeGrenze;
}

/**
 * Kalendertage ("YYYY-MM-DD") im Zeitraum von–bis (inklusive), die auf den
 * Wochentag fallen (1 = Montag … 7 = Sonntag). Reine Date-Key-Arithmetik —
 * DST-Wechsel verschieben nichts, weil Kalendertage gezählt werden.
 */
export function serienTermine(wochentag: number, vonKey: string, bisKey: string): string[] {
  if (wochentag < 1 || wochentag > 7) return [];
  const von = parseDateKeyStrict(vonKey);
  const bis = parseDateKeyStrict(bisKey);
  const startMs = Date.UTC(von.jahr, von.monat - 1, von.tag);
  const endeMs = Date.UTC(bis.jahr, bis.monat - 1, bis.tag);
  if (endeMs < startMs) return [];
  const termine: string[] = [];
  for (let ms = startMs; ms <= endeMs; ms += 86_400_000) {
    const d = new Date(ms);
    const key = d.toISOString().slice(0, 10);
    if (weekdayOfDateKey(key) === wochentag) termine.push(key);
  }
  return termine;
}

/** Positionstext der Vermietungs-Rechnung (Modul 9): Raum · Datum · Zeitfenster. */
export function vermietungsPositionText(
  raumName: string,
  dateKey: string,
  startZeit: string,
  endZeit: string,
): string {
  return `Raumvermietung «${raumName}» · ${formatDatum(dateKey)} · ${startZeit}–${endZeit}`;
}

/** Überschneiden sich zwei Minutenintervalle (halboffen, wie der
 * Planer-Konfliktcheck)? Berührung an der Kante ist kein Konflikt.
 */
export function ueberlappt(
  aVon: number,
  aBis: number,
  bVon: number,
  bBis: number,
): boolean {
  return aVon < bBis && bVon < aBis;
}
