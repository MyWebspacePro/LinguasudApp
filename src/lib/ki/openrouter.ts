import "server-only";

// OpenRouter-Client (Modul 14): ein einziger, schlanker Chat-Completions-
// Aufruf über die OpenAI-kompatible API. Kein SDK, nur fetch — so bleibt die
// Abhängigkeit klein und der Timeout kontrollierbar.

import type { KiPromptPaar } from "./logik";

const STANDARD_BASIS = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 90_000;

export interface OpenRouterAntwort {
  content: string;
  modell: string;
  tokenInput: number | null;
  tokenOutput: number | null;
}

export class OpenRouterFehler extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "OpenRouterFehler";
  }
}

interface ChatCompletionAntwort {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
}

function basisUrl(): string {
  return (process.env.OPENROUTER_BASE_URL ?? STANDARD_BASIS).replace(/\/+$/, "");
}

/**
 * Ruft das konfigurierte Modell auf. Der API-Key wird nur im Authorization-
 * Header verwendet und taucht in keiner Fehlermeldung auf.
 */
export async function frageOpenRouter(
  prompt: KiPromptPaar,
  optionen: { apiKey: string; modell: string },
): Promise<OpenRouterAntwort> {
  const apiKey = optionen.apiKey.trim();
  const modell = optionen.modell.trim();
  if (!apiKey) throw new OpenRouterFehler("Kein OpenRouter-API-Key hinterlegt.");
  if (!modell) throw new OpenRouterFehler("Kein Modell konfiguriert.");

  let antwort: Response;
  try {
    antwort = await fetch(`${basisUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
        "X-Title": "LinguasudApp KI-Lektionsgenerator",
      },
      body: JSON.stringify({
        model: modell,
        temperature: 0.4,
        max_tokens: 4096,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OpenRouterFehler("Die KI hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.");
    }
    throw new OpenRouterFehler("Die KI ist momentan nicht erreichbar. Bitte später erneut versuchen.");
  }

  const text = await antwort.text();
  let daten: ChatCompletionAntwort;
  try {
    daten = JSON.parse(text) as ChatCompletionAntwort;
  } catch {
    throw new OpenRouterFehler(
      antwort.ok ? "Die KI lieferte eine unlesbare Antwort." : `Die KI-Anfrage schlug fehl (HTTP ${antwort.status}).`,
      antwort.status,
    );
  }

  if (!antwort.ok || daten.error) {
    const meldung = daten.error?.message?.trim();
    const status = antwort.status;
    if (status === 401) {
      throw new OpenRouterFehler(
        "Der OpenRouter-API-Key ist ungültig oder abgelaufen. Admin: Key in den Stammdaten prüfen.",
        401,
      );
    }
    if (status === 402) {
      throw new OpenRouterFehler(
        "Das OpenRouter-Guthaben reicht nicht aus. Bitte Guthaben aufladen oder ein günstigeres Modell wählen.",
        402,
      );
    }
    if (status === 429) {
      throw new OpenRouterFehler(
        "OpenRouter hat zu viele Anfragen empfangen. Bitte kurz warten und erneut versuchen.",
        429,
      );
    }
    if (status >= 500) {
      throw new OpenRouterFehler("OpenRouter ist momentan nicht erreichbar. Bitte später erneut versuchen.", status);
    }
    throw new OpenRouterFehler(meldung || `Die KI-Anfrage schlug fehl (HTTP ${status}).`, status);
  }

  const content = daten.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new OpenRouterFehler("Die KI lieferte eine leere Antwort.");
  }

  return {
    content,
    modell: daten.model?.trim() || modell,
    tokenInput: typeof daten.usage?.prompt_tokens === "number" ? daten.usage.prompt_tokens : null,
    tokenOutput: typeof daten.usage?.completion_tokens === "number" ? daten.usage.completion_tokens : null,
  };
}
