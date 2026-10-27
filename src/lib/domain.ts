// Pures Domain-Modul (ohne DB-Client): Typen und Konvertierungs-Helfer, die
// auch in Client-Components gebraucht werden. Das typeof-Fenster bleibt hier
// bewusst klein — der eigentliche Client liegt in src/prisma/db.ts und wird
// über src/lib/db.ts exportiert (nur Servercode!).

import type { Models } from "@/prisma/contract.d";
import type { Scalars } from "@prisma/orm-postgres/family-contract/types";

// ——— Domain-Typen (vorher aus @prisma/client) ——————————————————————

/** Die 5 Rollen des Pflichtenhefts — Mehrfachrollen möglich. */
export type Role = NonNullable<NonNullable<Models.public_User["roles"]>[number]>;
export type KostentraegerArt = Models.public_Kostentraeger["art"];
export type AuthEventKind = Models.public_LoginAttempt["kind"];
/** Status-Laufbahn der Personen-Kartei (Modul 3): Interessent/in → aktiv → inaktiv. */
export type PersonStatus = Models.public_Person["status"];
/** Anrede/Geschlecht — zwingend laut Pflichtenheft. */
export type Anrede = Models.public_Person["anrede"];

/** Lebenszyklus eines fortlaufenden Kurses (Modul 4). */
export type KursStatus = Models.public_Kurs["status"];
/** Rechnungsweg der Anmeldung (Modul 5). */
export type BillingTyp = Models.public_Anmeldung["billingTyp"];
/** Anmeldung-Lebenszyklus: Probe → aktiv → beendet. */
export type AnmeldungStatus = Models.public_Anmeldung["status"];
/** Entscheid der Paketende-Automatik. */
export type PaketEntscheid = Models.public_Anmeldung["paketEntscheid"];
/** Journal-Art des Lektionsguthabens. */
export type JournalArt = Models.public_GuthabenJournal["art"];
/** Lektion-Status im Planer (Modul 6). */
export type LektionStatus = Models.public_Lektion["status"];
/** Anwesenheits-Entscheid pro Teilnehmende(r) und Lektion (Modul 7). */
export type AnwesenheitStatus = Models.public_Anwesenheit["status"];
/** Abweichungs-Art vom Büro-Pensum an einem konkreten Tag (Modul 8). */
export type BueroAbweichungArt = Models.public_BueroAbweichung["art"];
/** Abwesenheits-Art der Büropersonen (Modul 8). */
export type BueroAbwesenheitArt = Models.public_BueroAbwesenheit["art"];
/** Status der Honorar-Monatsabrechnung (Modul 11). */
export type HonorarStatus = Models.public_HonorarAbrechnung["status"];
/** Status einer Vermietung (Modul 12): geplant → findet statt · abgesagt. */
export type VermietungStatus = Models.public_Vermietung["status"];
/** Status-Laufbahn einer Anfrage aus dem öffentlichen Formular (Modul 13). */
export type AnfrageStatus = Models.public_Anfrage["status"];
/** Status einer Aufgabe (Modul 13): schlicht offen/erledigt. */
export type AufgabeStatus = Models.public_Aufgabe["status"];
/** Modus des KI-Lektionsgenerators (Modul 14): strukturiert oder freier Prompt. */
export type KiModus = Models.public_KiLektion["modus"];

/** Zeilen-Typen ohne Relationen (das, was Queries zurückgeben). */
export type UserRow = Scalars<Models.public_User>;
export type SessionRow = Scalars<Models.public_Session>;
export type AuditLogRow = Scalars<Models.public_AuditLog>;
export type PersonRow = Scalars<Models.public_Person>;
export type PersonNotizRow = Scalars<Models.public_PersonNotiz>;
export type PersonBeziehungRow = Scalars<Models.public_PersonBeziehung>;
export type LehrqualifikationRow = Scalars<Models.public_Lehrqualifikation>;
export type KursRow = Scalars<Models.public_Kurs>;
export type KursNiveauVerlaufRow = Scalars<Models.public_KursNiveauVerlauf>;
export type KursUnterbrechungRow = Scalars<Models.public_KursUnterbrechung>;
export type AnmeldungRow = Scalars<Models.public_Anmeldung>;
export type GuthabenJournalRow = Scalars<Models.public_GuthabenJournal>;
export type LektionRow = Scalars<Models.public_Lektion>;
export type AnwesenheitRow = Scalars<Models.public_Anwesenheit>;
export type BueroDienstRow = Scalars<Models.public_BueroDienst>;
export type BueroAbweichungRow = Scalars<Models.public_BueroAbweichung>;
export type BueroAbwesenheitRow = Scalars<Models.public_BueroAbwesenheit>;
export type BueroUrlaubskontingentRow = Scalars<Models.public_BueroUrlaubskontingent>;
export type HonorarSatzRow = Scalars<Models.public_HonorarSatz>;
export type HonorarAbrechnungRow = Scalars<Models.public_HonorarAbrechnung>;
export type EinstufungsfrageRow = Scalars<Models.public_Einstufungsfrage>;
export type AnfrageRow = Scalars<Models.public_Anfrage>;
export type AufgabeRow = Scalars<Models.public_Aufgabe>;
export type KiLektionRow = Scalars<Models.public_KiLektion>;
/**
 * KI-Lektion inklusive der beim Laden eingebundenen Relationen. Bewusst nur
 * die Skalar-Felder der Relationen: `.include("niveau")` lädt keine
 * Rück-Relationen (anfragen, kiLektionen …) mit, daher wäre der volle
 * `public_Niveau`-Typ zu streng.
 */
export type KiLektionMitRelationen = Scalars<Models.public_KiLektion> & {
  sprache: Scalars<Models.public_Sprache> | null;
  niveau: Scalars<Models.public_Niveau> | null;
  kursart: Scalars<Models.public_Kursart> | null;
};

/** Anrede-Bezeichnungen für Formulare und Anzeigen. */
export const ANREDE_LABELS: Record<Anrede, string> = {
  HERR: "Herr",
  FRAU: "Frau",
  DIVERS: "Divers",
};

/** Gültige Anrede-Werte (Reihenfolge für Auswahl). */
export const ANREDE_WERTE: readonly Anrede[] = ["HERR", "FRAU", "DIVERS"];

/** Status-Bezeichnungen der Personen-Kartei. */
export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  INTERESSENT: "Interessent/in",
  AKTIV: "aktiv",
  INAKTIV: "inaktiv",
};

/** Gültige Status-Werte in Laufbahn-Reihenfolge. */
export const PERSON_STATUS_WERTE: readonly PersonStatus[] = ["INTERESSENT", "AKTIV", "INAKTIV"];

/** Kursstatus-Bezeichnungen (Modul 4). */
export const KURS_STATUS_LABELS: Record<KursStatus, string> = {
  GEPLANT: "geplant",
  AKTIV: "aktiv",
  PAUSIERT: "pausiert",
  ABGESCHLOSSEN: "abgeschlossen",
  ABGESAGT: "abgesagt",
};

/** Gültige Kursstatus-Werte in Lebenszyklus-Reihenfolge. */
export const KURS_STATUS_WERTE: readonly KursStatus[] = [
  "GEPLANT",
  "AKTIV",
  "PAUSIERT",
  "ABGESCHLOSSEN",
  "ABGESAGT",
];

/** Billing-Typ-Bezeichnungen (Modul 5). */
export const BILLING_TYP_LABELS: Record<BillingTyp, string> = {
  PRIVAT: "privat",
  FIRMA: "Firma",
  OEFFENTLICHE_EINRICHTUNG: "öffentliche Einrichtung",
};

/** Gültige Billing-Typ-Werte. */
export const BILLING_TYP_WERTE: readonly BillingTyp[] = ["PRIVAT", "FIRMA", "OEFFENTLICHE_EINRICHTUNG"];

/** Anmeldung-Status-Bezeichnungen (Modul 5). */
export const ANMELDUNG_STATUS_LABELS: Record<AnmeldungStatus, string> = {
  PROBE: "Probe",
  AKTIV: "aktiv",
  BEENDET: "beendet",
};

/** Gültige Anmeldung-Status-Werte. */
export const ANMELDUNG_STATUS_WERTE: readonly AnmeldungStatus[] = ["PROBE", "AKTIV", "BEENDET"];

/** Journal-Art-Bezeichnungen (Modul 5). */
export const JOURNAL_ART_LABELS: Record<JournalArt, string> = {
  AUFLADUNG: "Paket-Aufladung",
  VERBRAUCH: "Lektions-Verbrauch",
  FEHLZEIT_UNENTSCHULDIGT: "Fehlzeit (unentschuldigt)",
  FEHLZEIT_ENTSCHULDIGT: "Fehlzeit (entschuldigt)",
  KORREKTUR: "Korrektur",
};

/** Lektion-Status-Bezeichnungen (Modul 6). */
export const LEKTION_STATUS_LABELS: Record<LektionStatus, string> = {
  PROVISORISCH: "provisorisch",
  FIXIERT: "fixiert",
  ABGESAGT: "abgesagt",
  DURCHGEFUEHRT: "durchgeführt",
};

/** Honorar-Status-Bezeichnungen (Modul 11). */
export const HONORAR_STATUS_LABELS: Record<HonorarStatus, string> = {
  OFFEN: "offen",
  BEZAHLT: "bezahlt",
};

/** Vermietungs-Status-Bezeichnungen (Modul 12). */
export const VERMIETUNG_STATUS_LABELS: Record<VermietungStatus, string> = {
  GEPLANT: "geplant",
  FINDET_STATT: "findet statt",
  ABGESAGT: "abgesagt",
};

/** Gültige Vermietungs-Status-Werte in Lebenszyklus-Reihenfolge. */
export const VERMIETUNG_STATUS_WERTE: readonly VermietungStatus[] = [
  "GEPLANT",
  "FINDET_STATT",
  "ABGESAGT",
];

/** Anfrage-Status-Bezeichnungen (Modul 13). */
export const ANFRAGE_STATUS_LABELS: Record<AnfrageStatus, string> = {
  OFFEN: "offen",
  IN_BEARBEITUNG: "in Bearbeitung",
  ZUGEORDNET: "zugeordnet",
  ABGELEHNT: "abgelehnt",
};

/** Gültige Anfrage-Status-Werte in Laufbahn-Reihenfolge. */
export const ANFRAGE_STATUS_WERTE: readonly AnfrageStatus[] = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "ZUGEORDNET",
  "ABGELEHNT",
];

/** Aufgaben-Status-Bezeichnungen (Modul 13). */
export const AUFGABE_STATUS_LABELS: Record<AufgabeStatus, string> = {
  OFFEN: "offen",
  ERLEDIGT: "erledigt",
};

/** Quelle einer Aufgabe (Modul 13) — für Badge und Audit-Kontext. */
export const AUFGABE_QUELLE_LABELS: Record<string, string> = {
  manual: "manuell",
  anfrage: "Anfrage",
  paketende: "Paket-Ende",
  anwesenheit: "Anwesenheit",
};

/** SystemSetting-Schlüssel für den globalen Default-Stundensatz (Modul 11). */
export const HONORAR_DEFAULT_KEY = "honorar.defaultStundensatz";

/**
 * List-Felder sind im Contract konservativ als (Element | null)[] | null
 * getypt — hier auf eine saubere Role[] normalisieren.
 */
export function roleList(roles: readonly (Role | null)[] | null): Role[] {
  return (roles ?? []).filter((r): r is Role => r !== null);
}

// ——— Datum/Zeit ——————————————————————————————————————————————————————
// Prisma 8 liefert DateTime-Spalten (timestamp) als ISO-String statt als
// Date-Objekt. Die Konvertierung läuft ausschliesslich über diese Helfer.

export function toDbTime(d: Date): string {
  return d.toISOString();
}

/**
 * Postgres liefert timestamp(3)-Spalten als Rohformat «2026-10-24 04:04:57.187»
 * ohne Zeitzonen-Marker; gespeichert wird UTC (Prisma 6 & 8 schreiben UTC).
 * Ohne «Z» würde new Date() die Zeichenkette als Lokalzeit deuten (±Stunden-Bug).
 */
export function fromDbTime(s: string): Date {
  return new Date(`${s.replace(" ", "T")}Z`);
}

/** Ist der Zeitstempel (DB-Rohformat) bereits vorbei? Für Server-Component-/Action-Kontext. */
export function isPastDbTime(s: string): boolean {
  return fromDbTime(s).getTime() <= Date.now();
}

// ——— Fehler-Kennung —————————————————————————————————————————————————
// Prisma 8 kennt keine P2002/P2003-Codes mehr; Unique-/FK-Verletzungen
// erkennen wir am PostgreSQL-sqlState.

function sqlStateOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "sqlState" in error
    ? String((error as { sqlState?: unknown }).sqlState)
    : undefined;
}

/** Unique-Verletzung (vorher Prisma-Fehlercode P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === "23505";
}

/** Fremdschlüssel-Verletzung — Eintrag ist anderweitig in Benutzung (P2003). */
export function isForeignKeyViolation(error: unknown): boolean {
  return sqlStateOf(error) === "23503";
}
