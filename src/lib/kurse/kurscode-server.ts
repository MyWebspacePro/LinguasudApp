import "server-only";

// Serverseitige Kurscode-Generierung (Modul 4): Sucht die nächste freie
// Serial für den Präfix Sprache-Niveau-Kursart-Lehrkürzel. Reine Logik liegt
// in kurscode.ts; hier nur der DB-Zugriff. Kollisionen im Augenblick des
// INSERTs fängt die aufrufende Action mit einem Retry ab (isUniqueViolation).

import { db } from "@/lib/db";
import { kursCodeMitSerial, kursCodePraefix, naechsteSerial } from "./kurscode";

/**
 * Nächster freier Kurscode. `bevorzugteSerial` erlaubt es, beim Niveau-Wechsel
 * die Serial des bisherigen Codes zu behalten (fällt nur bei Kollision auf
 * die nächste freie zurück).
 */
export async function naechsterKursCode(
  spracheCode: string,
  niveauCode: string,
  kursartName: string,
  lehrKuerzel: string | null,
  bevorzugteSerial?: number,
): Promise<string> {
  const praefix = kursCodePraefix(spracheCode, niveauCode, kursartName, lehrKuerzel);
  const escaped = `${praefix.replace(/[\\%_]/g, (c) => `\\${c}`)}-%`;
  const rows = await db.orm.public.Kurs
    .where((k) => k.code.ilike(escaped))
    .select("code")
    .all();
  const serial =
    bevorzugteSerial !== undefined && !rows.some((r) => r.code === kursCodeMitSerial(praefix, bevorzugteSerial))
      ? bevorzugteSerial
      : naechsteSerial(rows.map((r) => r.code), praefix);
  return kursCodeMitSerial(praefix, serial);
}
