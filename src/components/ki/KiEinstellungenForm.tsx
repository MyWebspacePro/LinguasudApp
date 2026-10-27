"use client";

// Admin-Formular für die KI-Anbindung (Modul 14): OpenRouter-API-Key und
// Modell. Der bestehende Key wird nur maskiert angezeigt und beim Speichern
// nie zurückgesendet, solange das Feld leer bleibt. Die Modellliste kommt
// bevorzugt live von OpenRouter; eine freie Modell-ID bleibt möglich.

import { useActionState } from "react";
import { speichereKiEinstellungenAction } from "@/lib/ki/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface KiModellOptionAnzeige {
  id: string;
  name: string;
  promptPreis: number;
  completionPreis: number;
}

export function KiEinstellungenForm({
  keyMaskiert,
  keyGesetzt,
  modell,
  modelle,
  keyQuelle,
  modellQuelle,
  modellListeQuelle,
}: {
  keyMaskiert: string;
  keyGesetzt: boolean;
  modell: string;
  modelle: KiModellOptionAnzeige[];
  keyQuelle: "db" | "env" | null;
  modellQuelle: "db" | "env" | "standard";
  modellListeQuelle: "openrouter" | "fallback";
}) {
  const [state, action] = useActionState(speichereKiEinstellungenAction, idleFormState);

  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label htmlFor="apiKey" className="label">
          OpenRouter API-Key {keyGesetzt ? "(gesetzt)" : "(nicht gesetzt)"}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          className="input font-mono"
          placeholder={keyGesetzt ? keyMaskiert : "sk-or-v1-…"}
        />
        <p className="mt-1 text-xs text-slate-500">
          Leer lassen, um den bestehenden Key zu behalten. Der Key wird nur auf dem Server gespeichert
          und nie im Klartext angezeigt.
        </p>
        {keyGesetzt && keyQuelle === "db" && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="keyEntfernen" className="h-4 w-4 rounded border-line" />
            Key entfernen (KI deaktivieren)
          </label>
        )}
        {keyQuelle === "env" && (
          <p className="mt-2 text-xs text-amber-700">
            Aktiver Key stammt aus der Umgebungsvariable <code>OPENROUTER_API_KEY</code>. Ein hier
            gespeicherter Key hat Vorrang; „Key entfernen“ deaktiviert nur den DB-Wert.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="modell" className="label">
          Modell (OpenRouter-Modell-ID) <span className="text-brand-700">*</span>
        </label>
        <input
          id="modell"
          name="modell"
          type="text"
          defaultValue={modell}
          list="ki-modell-liste"
          className="input font-mono"
          placeholder="openai/gpt-4o-mini"
        />
        <datalist id="ki-modell-liste">
          {modelle.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.promptPreis + m.completionPreis > 0
                ? ` · ${(m.promptPreis * 1_000_000).toFixed(2)} / ${(m.completionPreis * 1_000_000).toFixed(2)} USD pro 1M Tokens`
                : ""}
            </option>
          ))}
        </datalist>
        <p className="mt-1 text-xs text-slate-500">
          Günstige Modelle stehen oben. Freie Modell-ID aus der OpenRouter-Übersicht bleibt möglich.
          {modellQuelle === "env" && " Aktives Modell stammt aus der Umgebungsvariable OPENROUTER_MODEL."}
          {modellListeQuelle === "fallback" &&
            " Die Live-Modellliste war nicht erreichbar — es wird eine kuratierte Fallback-Liste angezeigt."}
        </p>
      </div>

      <FormAlert state={state} />
      <SubmitButton pendingText="Speichert …">Einstellungen speichern</SubmitButton>
    </form>
  );
}
