// Tarif-Logik (pur, testbar): Standard-Ableitung der Tarifstufe nach
// Tageszeit des Kursstarts. Hochtarif gilt im Mittags- und Abendfenster,
// sonst Niedertarif (Vormittag/Nachmittag). Das Büro kann in Modul 5
// jederzeit übersteuern.

export interface Tarifzeitfenster {
  middayFrom: string | null;
  middayTo: string | null;
  eveningFrom: string | null;
}

/** "HH:mm" → Minuten seit Mitternacht; null bei ungültig/leer. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Liegt der Startzeitpunkt (Minuten seit Mitternacht) in einem der
 * Hochtarif-Fenster (Mittag von–bis oder ab eveningFrom)?
 */
export function isHochtarifZeit(startMinutes: number, fenster: Tarifzeitfenster): boolean {
  const middayFrom = timeToMinutes(fenster.middayFrom);
  const middayTo = timeToMinutes(fenster.middayTo);
  if (middayFrom !== null && middayTo !== null && startMinutes >= middayFrom && startMinutes < middayTo) {
    return true;
  }
  const eveningFrom = timeToMinutes(fenster.eveningFrom);
  if (eveningFrom !== null && startMinutes >= eveningFrom) {
    return true;
  }
  return false;
}

/** Normalisierte Uhrzeit aus einem Input ("9:5" → "09:05"); null wenn ungültig. */
export function normalizeTimeInput(input: string): string | null {
  const trimmed = input.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (!match) return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
