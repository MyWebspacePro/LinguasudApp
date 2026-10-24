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

/** Zeilen-Typen ohne Relationen (das, was Queries zurückgeben). */
export type UserRow = Scalars<Models.public_User>;
export type SessionRow = Scalars<Models.public_Session>;
export type AuditLogRow = Scalars<Models.public_AuditLog>;
export type PersonRow = Scalars<Models.public_Person>;
export type PersonNotizRow = Scalars<Models.public_PersonNotiz>;
export type PersonBeziehungRow = Scalars<Models.public_PersonBeziehung>;
export type LehrqualifikationRow = Scalars<Models.public_Lehrqualifikation>;

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
