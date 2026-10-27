import "server-only";

// Modellliste für die Admin-Einstellungen (Modul 14). Bevorzugt wird der
// öffentliche OpenRouter-Endpunkt /api/v1/models; bei Netzwerkfehlern oder
// leeren Antworten greift eine kuratierte, günstige Fallback-Liste. Die
// Modell-ID bleibt zusätzlich frei eingebbar.

const STANDARD_BASIS = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 8_000;
const CACHE_SEKUNDEN = 3_600;
const MAX_MODELLE = 80;

export interface KiModellOption {
  id: string;
  name: string;
  /** Preis pro Prompt-Token in USD (0 = unbekannt/kostenlos). */
  promptPreis: number;
  /** Preis pro Completion-Token in USD. */
  completionPreis: number;
}

/** Günstige, verbreitete Modelle als Fallback (Preise Stand OpenRouter). */
export const KI_FALLBACK_MODELLE: readonly KiModellOption[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", promptPreis: 0.00000015, completionPreis: 0.0000006 },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", promptPreis: 0.0000001, completionPreis: 0.0000004 },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", promptPreis: 0.0000008, completionPreis: 0.000004 },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", promptPreis: 0.00000002, completionPreis: 0.00000005 },
  { id: "mistralai/mistral-nemo", name: "Mistral Nemo", promptPreis: 0.00000002, completionPreis: 0.00000004 },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 mini", promptPreis: 0.0000004, completionPreis: 0.0000016 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", promptPreis: 0.0000003, completionPreis: 0.0000025 },
];

export interface KiModellListe {
  modelle: KiModellOption[];
  quelle: "openrouter" | "fallback";
}

function basisUrl(): string {
  return (process.env.OPENROUTER_BASE_URL ?? STANDARD_BASIS).replace(/\/+$/, "");
}

function preisWert(wert: unknown): number {
  if (typeof wert === "number" && Number.isFinite(wert)) return wert;
  if (typeof wert === "string") {
    const zahl = Number.parseFloat(wert);
    return Number.isFinite(zahl) ? zahl : 0;
  }
  return 0;
}

function preisSumme(m: KiModellOption): number {
  return m.promptPreis + m.completionPreis;
}

/**
 * Lädt die Modellliste von OpenRouter (Name + ID, günstigste zuerst) und
 * cached das Ergebnis serverseitig für eine Stunde. Fehler werden nicht
 * geworfen — dann kommt die Fallback-Liste zurück, damit die Admin-Seite
 * immer bedienbar bleibt.
 */
export async function ladeKiModelle(): Promise<KiModellListe> {
  try {
    const antwort = await fetch(`${basisUrl()}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SEKUNDEN },
    });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);

    const daten = (await antwort.json()) as {
      data?: Array<{ id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } }>;
    };
    const modelle: KiModellOption[] = (daten.data ?? [])
      .filter((m): m is { id: string; name?: string; pricing?: { prompt?: unknown; completion?: unknown } } =>
        Boolean(m && typeof m.id === "string" && m.id.trim()),
      )
      .map((m) => ({
        id: m.id.trim(),
        name: typeof m.name === "string" && m.name.trim() ? m.name.trim() : m.id.trim(),
        promptPreis: preisWert(m.pricing?.prompt),
        completionPreis: preisWert(m.pricing?.completion),
      }))
      .sort((a, b) => preisSumme(a) - preisSumme(b) || a.name.localeCompare(b.name))
      .slice(0, MAX_MODELLE);

    if (modelle.length === 0) throw new Error("Leere Modellliste");
    return { modelle, quelle: "openrouter" };
  } catch (error) {
    console.error("OpenRouter-Modellliste konnte nicht geladen werden:", error);
    return { modelle: [...KI_FALLBACK_MODELLE].sort((a, b) => preisSumme(a) - preisSumme(b)), quelle: "fallback" };
  }
}
