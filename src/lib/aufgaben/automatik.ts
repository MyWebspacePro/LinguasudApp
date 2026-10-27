import "server-only";

// Automatik-Aufgaben (Modul 13): Aufgaben, die das System selbst anlegt —
// bei einer neuen Anfrage, am Paket-Ende ohne Antwort und bei offenen
// Anwesenheiten. Dedup: pro Vorgang (dedupKey, unique in der DB) genau EINE
// Aufgabe — auch nach dem Erledigen wird für denselben Vorgang nicht neu
// angelegt.

import { db, isUniqueViolation, toDbTime } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export interface AutomatikAufgabeInput {
  quelle: "anfrage" | "paketende" | "anwesenheit";
  /** Vorgangs-Marker, z.B. "anfrage:<id>" — verhindert Doppel-Aufgaben. */
  dedupKey: string;
  titel: string;
  beschreibung?: string | null;
  assigneeUserId?: string | null;
  /** Fälligkeit als UTC-Mitternacht des Lokal-Tags (Muster dbDatum()). */
  faelligAm?: Date | null;
  personId?: string | null;
  kursId?: string | null;
  anfrageId?: string | null;
}

/**
 * Legt eine Automatik-Aufgabe an; existiert für den Vorgang bereits eine
 * (offen oder erledigt), wird nichts unternommen (null zurückgegeben).
 */
export async function erstelleAutomatischeAufgabe(input: AutomatikAufgabeInput): Promise<string | null> {
  try {
    const created = await db.orm.public.Aufgabe.create({
      titel: input.titel,
      beschreibung: input.beschreibung ?? null,
      status: "OFFEN",
      assigneeUserId: input.assigneeUserId ?? null,
      faelligAm: input.faelligAm ? toDbTime(input.faelligAm) : null,
      personId: input.personId ?? null,
      kursId: input.kursId ?? null,
      anfrageId: input.anfrageId ?? null,
      quelle: input.quelle,
      dedupKey: input.dedupKey,
    });
    await recordAudit({
      actor: null,
      action: "aufgabe.automatisch_angelegt",
      entity: "aufgabe",
      entityId: created.id,
      summary: `Automatische Aufgabe angelegt: ${input.titel}`,
      details: { quelle: input.quelle, dedupKey: input.dedupKey },
    });
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) return null; // Aufgabe existiert bereits (Dedup)
    throw error;
  }
}

/**
 * Erledigt die offene Automatik-Aufgabe zu einem Vorgang — z.B. wenn die
 * Anfrage einer Person zugeordnet oder abgelehnt wurde.
 */
export async function erledigeAutomatikAufgabe(dedupKey: string, erledigtVonName: string): Promise<boolean> {
  const aufgabe = await db.orm.public.Aufgabe.where({ dedupKey }).first();
  if (!aufgabe || aufgabe.status !== "OFFEN") return false;
  await db.orm.public.Aufgabe.where({ id: aufgabe.id }).update({
    status: "ERLEDIGT",
    erledigtAt: toDbTime(new Date()),
    erledigtVonName,
  });
  return true;
}
