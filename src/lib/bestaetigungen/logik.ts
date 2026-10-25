// Kursbestätigungen (Modul 10) — reine Logik ohne DB-Zugriff: Briefanrede
// nach Anrede der Person und Zählung der besuchten Lektionen eines
// Niveau-Abschnitts. Das PDF enthält nur Deutsch und keine Leistungsbewertung.

import { fromDbTime } from "@/lib/domain";
import { dateKeyOf, formatDatum } from "@/lib/zeit";

/** Briefanrede aus Anrede-Code (HERR/FRAU/DIVERS) und vollem Namen. */
export function briefAnrede(anrede: string, personName: string): string {
  const teile = personName.trim().split(/\s+/);
  const nachname = teile.length > 1 ? teile.slice(1).join(" ") : personName;
  if (anrede === "HERR") return `Sehr geehrter Herr ${nachname}`;
  if (anrede === "FRAU") return `Sehr geehrte Frau ${nachname}`;
  return `Guten Tag ${personName}`;
}

/** Anrede-Zeile für den Adressblock: «Frau Anna Beispiel». */
export function anredeZeile(anrede: string, personName: string): string {
  if (anrede === "HERR") return `Herr ${personName}`;
  if (anrede === "FRAU") return `Frau ${personName}`;
  return personName;
}

/** Lektion (DB-Rohformat des startAt-Strings) für die Zählung. */
export interface ZaehlLektion {
  id: string;
  /** UTC-String aus der DB («YYYY-MM-DD HH:mm:ss»), Konvertierung via fromDbTime. */
  startAt: string;
}

/** Anwesenheit ANWESEND (Voraussetzung wird vom Aufrufer gefiltert). */
export interface ZaehlAnwesenheit {
  lektionId: string;
  anmeldungId: string;
}

/**
 * Besuchte Lektionen pro Anmeldung: zählt ANWESEND-Anwesenheiten in
 * DURCHGEFUEHRTen Lektionen des Kurses, deren Lokaltag (Europe/Zurich) im
 * Abschnitts-Zeitraum liegt — beide Grenzen inklusive. Lektionen ausserhalb
 * des Zeitraums werden ignoriert, Anmeldungen ohne Treffer erhalten 0.
 */
export function zaehleBesuchteLektionen(
  lektionen: readonly ZaehlLektion[],
  anwesenheiten: readonly ZaehlAnwesenheit[],
  vonKey: string,
  bisKey: string,
): Map<string, number> {
  const imAbschnitt = new Set(
    lektionen
      .filter((l) => {
        const key = dateKeyOf(fromDbTime(l.startAt));
        return key >= vonKey && key <= bisKey;
      })
      .map((l) => l.id),
  );

  const zahlen = new Map<string, number>();
  for (const anwesenheit of anwesenheiten) {
    if (!imAbschnitt.has(anwesenheit.lektionId)) continue;
    zahlen.set(
      anwesenheit.anmeldungId,
      (zahlen.get(anwesenheit.anmeldungId) ?? 0) + 1,
    );
  }
  return zahlen;
}

/** Zeitraum für Anzeige/PDF: «01.08.2026 – 23.10.2026». */
export function zeitraumText(vonKey: string, bisKey: string): string {
  return `${formatDatum(vonKey)} – ${formatDatum(bisKey)}`;
}
