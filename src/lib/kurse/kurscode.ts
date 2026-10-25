// Kurscode (Modul 4, pure): eindeutiger automatischer Code aus Sprache /
// Niveau / Kursart / Lehrpersonen-Kürzel + zweistelliger Serial,
// z.B. DE-B2-6ER-SMIT01-01. Bei einem Niveau-Wechsel wird der Code neu
// gebildet (Serial bleibt, wenn frei — siehe naechsteSerial).

/** Kursart-Name → Code-Segment ("6er" → "6ER", "Firmenkurs" → "FIRMENKURS"). */
export function kursartCode(name: string): string {
  const reduced = name
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!reduced) throw new Error(`Kursart-Code nicht ableitbar aus «${name}»`);
  return reduced;
}

/** Präfix vor der Serial: DE-B2-6ER-SMIT01 (Lehrkürzel optional). */
export function kursCodePraefix(
  spracheCode: string,
  niveauCode: string,
  kursart: string,
  lehrKuerzel: string | null,
): string {
  const teile = [spracheCode, niveauCode, kursartCode(kursart)];
  if (lehrKuerzel) teile.push(lehrKuerzel);
  return teile.join("-");
}

/** Vollständiger Code mit Serial (zweistellig). */
export function kursCodeMitSerial(praefix: string, serial: number): string {
  return `${praefix}-${String(serial).padStart(2, "0")}`;
}

/**
 * Nächste freie Serial für einen Präfix anhand bestehender Codes.
 * Nimmt die höchste vergebene Serial + 1 (Lücken bleiben — Codes sollen
 * stabil bleiben, wenn ein Kurs verschwindet).
 */
export function naechsteSerial(existingCodes: readonly string[], praefix: string): number {
  const prefixLower = praefix.toLowerCase();
  let max = 0;
  for (const code of existingCodes) {
    if (!code.toLowerCase().startsWith(`${prefixLower}-`)) continue;
    const serial = Number.parseInt(code.slice(praefix.length + 1), 10);
    if (Number.isInteger(serial) && serial > max) max = serial;
  }
  return max + 1;
}

/** Aufbau-Muster eines Kurscodes (für Validierung und Anzeige-Prüfung). */
export const KURS_CODE_MUSTER = /^[A-Z0-9]{2,3}-[A-Z0-9.]{1,6}-[A-Z0-9]+(?:-[A-Z0-9]+)?-\d{2}$/;

/** Zerlegt einen Kurscode in seine Bestandteile (null, wenn fremdes Format). */
export function zerlegeKursCode(code: string): {
  sprache: string;
  niveau: string;
  kursart: string;
  lehrKuerzel: string | null;
  serial: number;
} | null {
  if (!KURS_CODE_MUSTER.test(code)) return null;
  const teile = code.split("-");
  const serial = Number.parseInt(teile[teile.length - 1]!, 10);
  const kursart = teile[2]!;
  const lehrTeil = teile.slice(3, teile.length - 1);
  return {
    sprache: teile[0]!,
    niveau: teile[1]!,
    kursart,
    lehrKuerzel: lehrTeil.length > 0 ? lehrTeil.join("-") : null,
    serial,
  };
}
