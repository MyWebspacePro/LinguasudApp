// Pure Logik der Anfragen (Modul 13): Niveau-Empfehlung des Online-
// Einstufungstests («Durchsteig-Regel»), kompaktes Resultat-Format für die
// Weitergabe per URL (Test → Anfrage-Formular) und Drossel-Limits für das
// öffentliche Formular.

/** Ergebnis einer Teststufe: Niveau-Code + richtige Antworten von total. */
export interface NiveauErgebnis {
  /** Niveau-Code, z.B. "A1". */
  code: string;
  richtig: number;
  total: number;
}

export interface Empfehlung {
  code: string;
  /** Begründung für die Anzeige im Test-Ergebnis. */
  begruendung: string;
}

/** Stufe bestanden = mindestens die Hälfte der Antworten richtig. */
export function istStufeBestanden(e: NiveauErgebnis): boolean {
  if (e.total <= 0) return true; // nicht geprüfte Stufe blockiert nicht
  return e.richtig * 2 >= e.total;
}

/**
 * Niveau-Empfehlung aus den Stufen-Ergebnissen (aufsteigend A1→C2):
 * empfohlen wird die erste nicht bestandene Stufe (davor war man fertig) —
 * scheitert es an der ersten Stufe, ist das der Einstieg. Alle bestanden →
 * das höchste geprüfte Niveau. Keine geprüften Stufen → null.
 */
export function niveauEmpfehlung(ergebnisse: NiveauErgebnis[]): Empfehlung | null {
  const geprueft = ergebnisse.filter((e) => e.total > 0);
  if (geprueft.length === 0) return null;

  const index = geprueft.findIndex((e) => !istStufeBestanden(e));
  if (index >= 0) {
    const stufe = geprueft[index]!;
    return {
      code: stufe.code,
      begruendung:
        index === 0
          ? `Empfehlung: Niveau ${stufe.code} — Einstieg auf dieser Stufe.`
          : `Empfehlung: Niveau ${stufe.code} — die Stufe davor haben Sie abgeschlossen, diese noch nicht.`,
    };
  }
  const hoechstes = geprueft[geprueft.length - 1]!;
  const perfekt = hoechstes.richtig === hoechstes.total;
  return {
    code: hoechstes.code,
    begruendung: perfekt
      ? `Empfehlung: Niveau ${hoechstes.code} — alle geprüften Stufen vollständig richtig. Ein persönliches Einstufungsgespräch empfiehlt sich.`
      : `Empfehlung: Niveau ${hoechstes.code} — alle geprüften Stufen bestanden.`,
  };
}

// ——— Kompaktes Resultat-Format ("A1:3/3~A2:2/3") ————————————————————————

export interface TestResultat {
  proNiveau: NiveauErgebnis[];
  /** Niveau-Code der Empfehlung (null → keine Fragen vorhanden). */
  empfehlungCode: string | null;
}

/** Kompaktes, URL-sicheres Resultat für die Weitergabe Test → Anfrage. */
export function formatiereTestResultat(res: TestResultat): string {
  return res.proNiveau
    .filter((e) => e.total > 0)
    .map((e) => `${e.code}:${e.richtig}/${e.total}`)
    .join("~");
}

/**
 * Liest das Resultat-Format strikt zurück: eine kaputte Stufe verwirft das
 * ganze Resultat (null) — die Anfrage speichert dann ohne Test-Snapshot.
 */
export function parseTestResultat(roh: string | null | undefined): TestResultat | null {
  if (!roh) return null;
  const proNiveau: NiveauErgebnis[] = [];
  for (const teil of roh.split("~")) {
    const match = /^([A-Za-z0-9]{1,8}):(\d{1,3})\/(\d{1,3})$/.exec(teil);
    if (!match) return null;
    const richtig = Number(match[2]);
    const total = Number(match[3]);
    if (richtig > total) return null;
    proNiveau.push({ code: match[1]!, richtig, total });
  }
  if (proNiveau.length === 0) return null;
  const empfehlung = niveauEmpfehlung(proNiveau);
  return { proNiveau, empfehlungCode: empfehlung?.code ?? null };
}

// ——— Drossel des öffentlichen Anfrage-Formulars ——————————————————————————

/** Drossel pro E-Mail (Fenster 1 Stunde) — Muster Brute-Force-Schutz. */
export const ANFRAGE_MAX_PER_EMAIL = 3;
/** Drossel pro IP (Fenster 1 Stunde). */
export const ANFRAGE_MAX_PER_IP = 10;
/** Auswertungsfenster. */
export const ANFRAGE_WINDOW_MS = 60 * 60 * 1000;

export interface AnfrageDrosselOptions {
  windowMs: number;
  maxPerEmail: number;
  maxPerIp: number;
}

export const ANFRAGE_DROSSEL_OPTIONS: AnfrageDrosselOptions = {
  windowMs: ANFRAGE_WINDOW_MS,
  maxPerEmail: ANFRAGE_MAX_PER_EMAIL,
  maxPerIp: ANFRAGE_MAX_PER_IP,
};

/** Grundlegende E-Mail-Prüfung (Format), überall gleich angewandt. */
export function istGueltigeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
