// Pure Logik des schlichten Aufgaben-Systems (Modul 13): Fälligkeits-Infos.

/** Ist eine Aufgabe (in Anzeige-Koordinaten) überfällig? */
export function istAufgabeUeberfaellig(
  aufgabe: { status: string; faelligAm: string | null },
  heuteKey: string,
): boolean {
  return aufgabe.status === "OFFEN" && aufgabe.faelligAm !== null && aufgabe.faelligAm < heuteKey;
}

/** Reihenfolge der Aufgabenliste: überfällige zuerst, dann ohne Fälligkeit hinten. */
export function faelligkeitsSortKey(a: { status: string; faelligAm: string | null }): number {
  if (!a.faelligAm) return Number.MAX_SAFE_INTEGER;
  // Date-Keys sortieren lexikografisch korrekt; als Zahl für den Comparator.
  return Number(a.faelligAm.replace(/-/g, ""));
}
