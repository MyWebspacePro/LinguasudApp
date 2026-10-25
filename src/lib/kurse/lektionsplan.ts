// Termin-Expansion für die rollierende Lektionsgenerierung (Modul 6, pure).
// Aus dem wöchentlichen Fixtermin eines Kurses entstehen die konkreten
// Termine im Horizon — ohne Unterbrechungs-Zeiträume. Das DB-Schreiben
// (idempotent) liegt im Server-Modul lektionsgenerierung.ts.

import { addDays, tageZwischen, weekdayOfDateKey, zonedTimeToUtc } from "@/lib/zeit";

export interface KursTerminQuelle {
  /** 1 = Montag … 6 = Samstag (ISO-8601). */
  wochentag: number;
  /** "HH:mm" Lokalzeit (Europe/Zurich). */
  startZeit: string;
  dauerMinuten: number;
}

export interface UnterbrechungsZeitraum {
  /** "YYYY-MM-DD", inklusive. */
  vonKey: string;
  /** "YYYY-MM-DD", inklusive. */
  bisKey: string;
}

export interface GeplanterTermin {
  dateKey: string;
  /** UTC-Instant des Starts (ISO). */
  startUtcISO: string;
  dauerMinuten: number;
}

/**
 * Expandiert den Wochentermin über den Horizon [vonKey … bisKey] (inklusive)
 * und lässt Tage innerhalb von Unterbrechungen weg. Sonntage sind als
 * Schulbetrieb ausgeschlossen (Planer Mo–Sa).
 */
export function geplanteTermine(
  quelle: KursTerminQuelle,
  vonKey: string,
  bisKey: string,
  unterbrechungen: readonly UnterbrechungsZeitraum[] = [],
): GeplanterTermin[] {
  if (quelle.wochentag < 1 || quelle.wochentag > 6) return [];
  const dauer = tageZwischen(vonKey, bisKey);
  const termine: GeplanterTermin[] = [];
  for (let i = 0; i <= dauer; i++) {
    const dateKey = addDays(vonKey, i);
    if (weekdayOfDateKey(dateKey) !== quelle.wochentag) continue;
    if (unterbrechungen.some((u) => dateKey >= u.vonKey && dateKey <= u.bisKey)) continue;
    termine.push({
      dateKey,
      startUtcISO: zonedTimeToUtc(dateKey, quelle.startZeit).toISOString(),
      dauerMinuten: quelle.dauerMinuten,
    });
  }
  return termine;
}

/** Standard-Horizont der Generierung: ab heute (bzw. Offset) n Kalendertage. */
export function horizonVonBis(heuteKey: string, tageImVoraus = 14, abOffset = 0): { vonKey: string; bisKey: string } {
  return { vonKey: addDays(heuteKey, abOffset), bisKey: addDays(heuteKey, tageImVoraus) };
}
