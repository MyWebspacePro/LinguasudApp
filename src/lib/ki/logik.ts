// KI-Lektionsgenerator (Modul 14) — pure Logik: Parameter, Prompt-Aufbau,
// Ergebnis-Validierung. Bewusst frei von Server-/DB-Importen, damit die
// Client-Vorschau und die Vitest-Tests dieselbe Logik nutzen können.

import type { KiModus } from "@/lib/domain";

export const KI_MODUS_LABELS: Record<KiModus, string> = {
  STRUKTUR: "Strukturiert",
  FREI: "Freier Prompt",
};

export const KI_MODUS_WERTE: readonly KiModus[] = ["STRUKTUR", "FREI"];

/** Grenzen, damit ein einzelner Aufruf nicht unkontrolliert Kosten erzeugt. */
export const KI_MAX_THEMA = 1200;
export const KI_MAX_PROMPT = 8000;
export const KI_MAX_DAUER_MINUTEN = 600;
export const KI_MAX_ZIELE = 12;
export const KI_MAX_ZIEL = 300;

/** Strukturierte Eingabe (Modus STRUKTUR). */
export interface KiParameterStruktur {
  sprache: string;
  niveau: string;
  kursart: string | null;
  dauerMinuten: number;
  lernziele: string[];
  zusatzhinweise: string | null;
}

/** Freier Prompt (Modus FREI). */
export interface KiParameterFrei {
  prompt: string;
}

export type KiParameter = KiParameterStruktur | KiParameterFrei;

/** Ein Ablauf-Schritt des strukturierten Ergebnisses. */
export interface KiAblaufSchritt {
  phase: string;
  dauerMinuten: number;
  beschreibung: string;
}

export interface KiErgebnisStruktur {
  lernziele: string[];
  ablauf: KiAblaufSchritt[];
  materialien: string[];
  hausaufgabe: string;
}

export interface KiErgebnisFrei {
  text: string;
}

/**
 * Fallback, wenn das Modell kein gültiges JSON/Schema liefert: Der Rohtext
 * wird unverändert angezeigt und kann trotzdem gespeichert/gedruckt werden.
 */
export interface KiErgebnisRohtext {
  rohtext: string;
}

export type KiErgebnis = KiErgebnisStruktur | KiErgebnisFrei | KiErgebnisRohtext;

export function istRohtext(ergebnis: KiErgebnis): ergebnis is KiErgebnisRohtext {
  return "rohtext" in ergebnis;
}

export interface KiPromptPaar {
  system: string;
  user: string;
}

const SYSTEM_STRUKTUR = [
  "Du bist eine erfahrene Lehrperson für Sprachkurse an einer Schweizer Sprachschule.",
  "Erstelle einen vollständigen, unterrichtsfertigen Lektionsplan auf Deutsch (Schweizer Rechtschreibung: kein ß).",
  "Der Plan muss zum angegebenen Sprachniveau und zur Kursart passen und die angegebene Dauer einhalten.",
  "Antworte ausschliesslich mit gültigem JSON nach diesem Schema — keine Erklärungen, kein Markdown:",
  '{"lernziele":["..."],"ablauf":[{"phase":"...","dauerMinuten":15,"beschreibung":"..."}],"materialien":["..."],"hausaufgabe":"..."}',
  "Regeln: 3–6 präzise Lernziele; der Ablauf deckt die Gesamtdauer mit sinnvollen Phasen ab (Einstieg, Erarbeitung, Übung, Sicherung); Materialien konkret benennen; die Hausaufgabe ist kurz und passend.",
].join("\n");

const SYSTEM_FREI = [
  "Du bist eine erfahrene Lehrperson für Sprachkurse an einer Schweizer Sprachschule.",
  "Erfülle den folgenden Auftrag sorgfältig und unterrichtsfertig auf Deutsch (Schweizer Rechtschreibung: kein ß).",
  "Antworte ausschliesslich mit gültigem JSON nach diesem Schema — keine Erklärungen, kein Markdown:",
  '{"text":"..."}',
  "Der Text darf Absätze und Aufzählungen mit Zeilenumbrüchen enthalten (als \\n im JSON).",
].join("\n");

function zeilen(...werte: Array<string | null | undefined>): string {
  return werte.filter((w): w is string => Boolean(w && w.trim())).join("\n");
}

/**
 * Baut System- und User-Prompt für den gewählten Modus. Der Aufrufer reicht
 * das Paar an den OpenRouter-Client weiter; die zusammengefasste Fassung
 * landet im Feld `prompt` der gespeicherten Lektion.
 */
export function bauePrompt(modus: KiModus, parameter: KiParameter): KiPromptPaar {
  if (modus === "FREI") {
    const p = parameter as KiParameterFrei;
    return { system: SYSTEM_FREI, user: p.prompt.trim() };
  }

  const p = parameter as KiParameterStruktur;
  const ziele = p.lernziele.length > 0 ? p.lernziele.map((z, i) => `${i + 1}. ${z}`).join("\n") : "— keine Vorgaben, bitte sinnvoll ableiten";
  const user = zeilen(
    `Sprache: ${p.sprache}`,
    `Niveau: ${p.niveau}`,
    p.kursart ? `Kursart: ${p.kursart}` : null,
    `Dauer der Lektion: ${p.dauerMinuten} Minuten`,
    "Lernziele (Vorgaben):",
    ziele,
    p.zusatzhinweise ? `Zusätzliche Hinweise: ${p.zusatzhinweise}` : null,
    "Der Ablauf muss in Summe die angegebene Dauer ergeben.",
  );
  return { system: SYSTEM_STRUKTUR, user };
}

/** Fasst System- und User-Prompt für die Speicherung/Audit zusammen. */
export function promptAlsText(paar: KiPromptPaar): string {
  return `SYSTEM:\n${paar.system}\n\nUSER:\n${paar.user}`;
}

/**
 * Entfernt Markdown-Codezäune und schneidet den ersten JSON-Block heraus.
 * So bleiben auch Antworten mit kurzen Vor-/Nachbemerkungen verwendbar.
 */
function extrahiereJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const basis = fence ? fence[1].trim() : trimmed;
  const start = basis.indexOf("{");
  if (start === -1) return basis;

  let tiefe = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < basis.length; i++) {
    const zeichen = basis[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (zeichen === "\\") escaped = true;
      else if (zeichen === '"') inString = false;
      continue;
    }
    if (zeichen === '"') {
      inString = true;
      continue;
    }
    if (zeichen === "{") tiefe++;
    else if (zeichen === "}") {
      tiefe--;
      if (tiefe === 0) return basis.slice(start, i + 1);
    }
  }
  return basis;
}

function istStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Parst das Modell-Ergebnis robust. Gültiges JSON nach Schema wird
 * normalisiert; bei ungültigem JSON oder falschem Schema greift der
 * Rohtext-Fallback, damit die Antwort nicht verloren geht. Leere Antworten
 * werden weiterhin als Fehler gemeldet.
 */
export function parseKiErgebnis(raw: string, modus: KiModus): KiErgebnis {
  const text = raw.trim();
  if (!text) throw new Error("Die KI lieferte eine leere Antwort.");

  let daten: unknown;
  try {
    daten = JSON.parse(extrahiereJsonText(text));
  } catch {
    return modus === "FREI" ? { text } : { rohtext: text };
  }
  if (typeof daten !== "object" || daten === null) {
    return modus === "FREI" ? { text } : { rohtext: text };
  }

  if (modus === "FREI") {
    const inhalt = (daten as { text?: unknown }).text;
    if (typeof inhalt === "string" && inhalt.trim().length > 0) {
      return { text: inhalt.trim() };
    }
    return { text };
  }

  const d = daten as Record<string, unknown>;
  if (
    !istStringArray(d.lernziele) ||
    !istStringArray(d.materialien) ||
    typeof d.hausaufgabe !== "string" ||
    !Array.isArray(d.ablauf) ||
    d.ablauf.length === 0
  ) {
    return { rohtext: text };
  }

  const ablauf: KiAblaufSchritt[] = [];
  for (let index = 0; index < d.ablauf.length; index++) {
    const schritt = d.ablauf[index];
    if (!schritt || typeof schritt !== "object") return { rohtext: text };
    const s = schritt as Record<string, unknown>;
    const phase = typeof s.phase === "string" && s.phase.trim() ? s.phase.trim() : `Phase ${index + 1}`;
    const dauerMinuten =
      typeof s.dauerMinuten === "number" && Number.isFinite(s.dauerMinuten)
        ? Math.max(1, Math.round(s.dauerMinuten))
        : 0;
    const beschreibung = typeof s.beschreibung === "string" ? s.beschreibung.trim() : "";
    if (!beschreibung) return { rohtext: text };
    ablauf.push({ phase, dauerMinuten, beschreibung });
  }

  return {
    lernziele: d.lernziele.map((z) => z.trim()).filter(Boolean),
    ablauf,
    materialien: d.materialien.map((m) => m.trim()).filter(Boolean),
    hausaufgabe: d.hausaufgabe.trim(),
  };
}

/**
 * Prüft die Eingabe vor dem Aufruf. Gibt eine Feld→Meldung-Map zurück
 * (leer = gültig) — der Client und die Action nutzen dieselbe Prüfung.
 */
export function pruefeParameter(modus: KiModus, parameter: KiParameter): Record<string, string> {
  const fehler: Record<string, string> = {};

  if (modus === "FREI") {
    const p = parameter as KiParameterFrei;
    const prompt = p.prompt.trim();
    if (prompt.length < 20) fehler.prompt = "Bitte mindestens 20 Zeichen eingeben.";
    if (prompt.length > KI_MAX_PROMPT) fehler.prompt = `Maximal ${KI_MAX_PROMPT} Zeichen.`;
    return fehler;
  }

  const p = parameter as KiParameterStruktur;
  if (!p.sprache.trim()) fehler.sprache = "Bitte eine Sprache wählen.";
  if (!p.niveau.trim()) fehler.niveau = "Bitte ein Niveau wählen.";
  if (!Number.isFinite(p.dauerMinuten) || p.dauerMinuten < 15 || p.dauerMinuten > KI_MAX_DAUER_MINUTEN) {
    fehler.dauerMinuten = `Dauer zwischen 15 und ${KI_MAX_DAUER_MINUTEN} Minuten.`;
  }
  if (p.lernziele.length > KI_MAX_ZIELE) fehler.lernziele = `Maximal ${KI_MAX_ZIELE} Lernziele.`;
  for (const ziel of p.lernziele) {
    if (ziel.length > KI_MAX_ZIEL) {
      fehler.lernziele = `Ein Lernziel ist länger als ${KI_MAX_ZIEL} Zeichen.`;
      break;
    }
  }
  if ((p.zusatzhinweise ?? "").length > KI_MAX_THEMA) {
    fehler.zusatzhinweise = `Maximal ${KI_MAX_THEMA} Zeichen.`;
  }
  return fehler;
}

/** Baut einen sicheren Titel aus den Parametern (max. 120 Zeichen). */
export function baueTitel(modus: KiModus, parameter: KiParameter): string {
  if (modus === "FREI") {
    const prompt = (parameter as KiParameterFrei).prompt.trim().replace(/\s+/g, " ");
    return prompt.length <= 80 ? prompt : `${prompt.slice(0, 77)}…`;
  }
  const p = parameter as KiParameterStruktur;
  const basis = `${p.sprache} ${p.niveau}${p.kursart ? ` · ${p.kursart}` : ""} · ${p.dauerMinuten} Min.`;
  return basis.length <= 120 ? basis : `${basis.slice(0, 117)}…`;
}

/** Kurzfassung des Themas für Listen (max. 140 Zeichen). */
export function themaAuszug(modus: KiModus, parameter: KiParameter): string {
  if (modus === "FREI") {
    const prompt = (parameter as KiParameterFrei).prompt.trim().replace(/\s+/g, " ");
    return prompt.length <= 140 ? prompt : `${prompt.slice(0, 137)}…`;
  }
  const p = parameter as KiParameterStruktur;
  const teile = [p.sprache, p.niveau, p.kursart, `${p.dauerMinuten} Min.`].filter(Boolean);
  return teile.join(" · ");
}

/** Summe der Ablaufdauer (für die Plausibilitätsanzeige im UI). */
export function ablaufSumme(ergebnis: KiErgebnis): number {
  if (!("ablauf" in ergebnis)) return 0;
  return ergebnis.ablauf.reduce((summe, s) => summe + (Number.isFinite(s.dauerMinuten) ? s.dauerMinuten : 0), 0);
}

/**
 * Zeigt einen API-Key maskiert an (nur die letzten 4 Zeichen). Leere Werte
 * bleiben leer; kurze Keys werden vollständig maskiert.
 */
export function maskiereKey(key: string | null | undefined): string {
  if (!key) return "";
  const s = key.trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}

/** Prüft, ob ein Key plausibel gesetzt ist (nicht leer, Mindestlänge). */
export function istKeyGesetzt(key: string | null | undefined): boolean {
  return Boolean(key && key.trim().length >= 8);
}
