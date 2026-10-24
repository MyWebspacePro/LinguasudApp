// Lehrpersonen-Kürzel (Modul 3): automatisch aus Vor- + Nachname abgeleitet,
// eindeutig — bei Doppelung erhält die neu anlegende Person ein Suffix.
// Basis = erster Buchstabe des Vornamens + erste 3 Buchstaben des Nachnamens
// (z.B. «Sandra Mittal» → SMIT; Kurscodes hängen daran: DE-B2-6ER-SMIT01-01).
// Kürzel bleiben nach Namensänderungen stabil (Kurscodes referenzieren sie).

/**
 * Umlaute/Akzente für Kürzel auf ASCII-Buchstaben reduzieren
 * (Müller → MULL, José → JOSE, ß → SS). Bleibt nicht-ASCII (z.B. andere
 * Schriften), werden Unicode-Buchstaben als Fallback belassen.
 */
export function kuerzelAscii(s: string): string {
  const reduced = s
    .replace(/[ßẞ]/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (reduced) return reduced;
  return s
    .replace(/[ßẞ]/g, "ss")
    .replace(/[^\p{L}]/gu, "")
    .toUpperCase();
}

/** Kürzel-Basis aus Vor- + Nachname; leer, wenn kein Buchstabe ableitbar ist. */
export function kuerzelBasis(vorname: string, nachname: string): string {
  const v = kuerzelAscii(vorname);
  const n = kuerzelAscii(nachname);
  if (!v || !n) return "";
  return (v[0]! + n.slice(0, 3)).slice(0, 8);
}

/** Basis ohne Suffix (suffix 0) bzw. mit zweistelligem Suffix (SMIT, SMIT01, …). */
export function kuerzelMitSuffix(basis: string, suffix: number): string {
  if (suffix <= 0) return basis;
  return `${basis}${String(suffix).padStart(2, "0")}`;
}
