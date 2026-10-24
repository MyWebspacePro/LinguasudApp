import "server-only";

// Serverseitiger Teil des Kürzel-Generators: sucht das nächste freie
// Lehrpersonen-Kürzel in der Datenbank. Von der Personen- UND der
// Benutzerverwaltung gebraucht — deshalb eigenes Modul (kein "use server").

import { db } from "@/lib/db";
import { kuerzelBasis, kuerzelMitSuffix } from "./kuerzel";

/**
 * Nächstes freies Kürzel: Basis aus Vor-/Nachname, bei Belegung zweistelliges
 * Suffix (SMIT, SMIT01, SMIT02, …).
 */
export async function nextFreeKuerzel(vorname: string, nachname: string): Promise<string> {
  const basis = kuerzelBasis(vorname, nachname);
  if (!basis) throw new Error("Kürzel kann aus diesen Namen nicht abgeleitet werden.");

  // LIKE-Teiltreffer ohne Gross-/Kleinschreibung; Wildcards werden escapt.
  const prefix = `${basis.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.orm.public.Person
    .where((p) => p.kuerzel.ilike(prefix))
    .select("kuerzel")
    .all();
  const taken = new Set(rows.map((r) => r.kuerzel).filter((k): k is string => k !== null));

  for (let n = 0; n < 500; n++) {
    const candidate = kuerzelMitSuffix(basis, n);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Kein freies Lehrpersonen-Kürzel gefunden.");
}
