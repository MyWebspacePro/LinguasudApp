// Anwesenheitslogik (Modul 7, pure): 24-h-Fenster der Lehrperson, Abbuchungs-
// Deltas je Anwesenheitsstatus, Probe ohne Abbuchung, Vollständigkeitsprüfung.
// Der Abschluss bucht das Guthaben-Journal (Paketfortschritt über
// verbrauchtImPaket aus src/lib/anmeldungen/paket.ts); diese Logik ist
// bewusst ohne DB-Client getestbar.

import type { AnwesenheitStatus, JournalArt } from "@/lib/db";
import { toDbTime } from "@/lib/domain";
import { SCHUL_ZEITZONE, dateKeyOf } from "@/lib/zeit";

/** Lehrpersonen dürfen die Anwesenheit 24 h nach Lektionsende erfassen; danach nur noch das Büro. */
export const ANWESENHEIT_FENSTER_STUNDEN = 24;

/** Kurz-Bezeichnungen für Formulare/Badges. */
export const ANWESENHEIT_STATUS_LABELS: Record<AnwesenheitStatus, string> = {
  ANWESEND: "anwesend",
  ABWESEND_ENTSCHULDIGT: "abwesend (entschuldigt)",
  ABWESEND_UNENTSCHULDIGT: "abwesend (unentschuldigt)",
};

/** Guthaben-Delta je Status laut Pflichtenheft: anwesend −1, unentschuldigt −1, entschuldigt −0. */
export function deltaVonAnwesenheit(status: AnwesenheitStatus): number {
  switch (status) {
    case "ANWESEND":
      return -1;
    case "ABWESEND_UNENTSCHULDIGT":
      return -1;
    case "ABWESEND_ENTSCHULDIGT":
      return 0;
  }
}

/** Journal-Art zum Anwesenheitsstatus (Probe-Anmeldungen werden ohne Abbuchung erfasst). */
export function journalArtVonAnwesenheit(status: AnwesenheitStatus): JournalArt {
  switch (status) {
    case "ANWESEND":
      return "VERBRAUCH";
    case "ABWESEND_UNENTSCHULDIGT":
      return "FEHLZEIT_UNENTSCHULDIGT";
    case "ABWESEND_ENTSCHULDIGT":
      return "FEHLZEIT_ENTSCHULDIGT";
  }
}

/** Ende des Erfassungsfensters (Lektionsende + 24 h) als DB-Zeit. */
export function fensterEndeDbTime(lektionsEnde: Date): string {
  return toDbTime(new Date(lektionsEnde.getTime() + ANWESENHEIT_FENSTER_STUNDEN * 60 * 60 * 1000));
}

/** Parst DB-Rohformat ("2026-10-27 17:00:00.000") und ISO ("…Z") tolerant als UTC. */
function parseDbOrIsoTime(s: string): Date {
  return s.endsWith("Z") ? new Date(s) : new Date(`${s.replace(" ", "T")}Z`);
}

/** Ist das 24-h-Fenster der Lehrperson abgelaufen (Server-Kontext)? */
export function istFensterAbgelaufen(lektionsEndeDb: string, now: number = Date.now()): boolean {
  return parseDbOrIsoTime(lektionsEndeDb).getTime() + ANWESENHEIT_FENSTER_STUNDEN * 60 * 60 * 1000 <= now;
}

/**
 * Ist die Erfassung für diese Lektion vollständig? (Jede aktive Anmeldung hat
 * einen Status.) Probe-Anmeldungen erscheinen zwar in der Liste, zählen aber
 * nicht als Pflicht — sie werden ohne Abbuchung erfasst.
 */
export function istVollstaendigErfasst(
  anmeldungen: readonly { id: string; status: string }[],
  erfasst: ReadonlyMap<string, AnwesenheitStatus>,
): boolean {
  return anmeldungen
    .filter((a) => a.status === "AKTIV")
    .every((a) => erfasst.has(a.id));
}

/** Kalendertag (Date-Key) des Lektionsendes in der Schul-Zeitzone. */
export function lektionsEndeDateKey(startAtDb: string, dauerMinuten: number): string {
  const ende = new Date(parseDbOrIsoTime(startAtDb).getTime() + dauerMinuten * 60_000);
  return dateKeyOf(ende, SCHUL_ZEITZONE);
}
