// Planer-Raster (Modul 6, pure): Zeitfenster, Skalierung und Navigations-
// Tage des Raumplaners. Layout: Spalten oben = Standort → Etage → Räume,
// Zeilen = Zeit 06:30–23:00.

import { addDays, weekdayOfDateKey } from "@/lib/zeit";

/** Betrachtetes Tagesfenster des Planers (06:30–23:00). */
export const PLAN_FENSTER = {
  vonMinute: 6 * 60 + 30,
  bisMinute: 23 * 60,
} as const;

/** Pixel pro Minute (16.5 h ≈ 990 px Gesamthöhe). */
export const PX_PRO_MINUTE = 1;

/** Kein Kurs startet nach 21:00; spätere 2h-Kurse bleiben im Fenster sichtbar. */
export const LETZTER_KURSSTART_MINUTE = 21 * 60;

/** Horizontale Position eines Blocks relativ zum Fensterrand (px). */
export function blockTop(minuteOfDay: number): number {
  return Math.max(0, (minuteOfDay - PLAN_FENSTER.vonMinute) * PX_PRO_MINUTE);
}

/** Höhe eines Blocks in px (min. 18 px, damit 45-Min-Blöcke gut klickbar sind). */
export function blockHoehe(dauerMinuten: number): number {
  return Math.max(18, dauerMinuten * PX_PRO_MINUTE);
}

/** Gesamthöhe des Zeitrasters in px. */
export const RASTER_HOEHE = (PLAN_FENSTER.bisMinute - PLAN_FENSTER.vonMinute) * PX_PRO_MINUTE;

/** Stundenlinien des Rasters (ganze Stunden ab 07:00). */
export function stundenLinien(): number[] {
  const linien: number[] = [];
  for (let m = PLAN_FENSTER.vonMinute + 30; m < PLAN_FENSTER.bisMinute; m += 60) {
    linien.push(m);
  }
  return linien;
}

/** Halbstunden-Marken (schwächer). */
export function halbStundenLinien(): number[] {
  const linien: number[] = [];
  for (let m = PLAN_FENSTER.vonMinute; m < PLAN_FENSTER.bisMinute; m += 30) {
    linien.push(m);
  }
  return linien;
}

/**
 * Navigations-Tage des Planers: die Mo–Sa-Tage im 14-Tage-Horizont ab dem
 * gegebenen Tag (Sonntage ausgeschlossen — kein Schulbetrieb).
 */
export function planTage(abDateKey: string, horizonTage = 13): string[] {
  const tage: string[] = [];
  for (let i = 0; i <= horizonTage; i++) {
    const key = addDays(abDateKey, i);
    if (weekdayOfDateKey(key) !== 7) tage.push(key);
  }
  return tage;
}
