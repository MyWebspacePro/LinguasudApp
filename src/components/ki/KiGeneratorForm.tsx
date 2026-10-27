"use client";

// Generator-Formular (Modul 14): zweistufig — zuerst generieren (Server
// Action ruft OpenRouter), dann den Vorschlag prüfen und speichern. Der
// Vorschlag bleibt nach der Generierung bearbeitbar (Titel/Thema); Prompt,
// Parameter und Ergebnis reisen als versteckte Felder mit.

import { useActionState, useState } from "react";
import { generiereKiLektionAction, speichereKiLektionAction } from "@/lib/ki/actions";
import { idleKiGeneratorState } from "@/lib/ki/state";
import { idleFormState } from "@/lib/forms";
import { KI_MAX_DAUER_MINUTEN, KI_MAX_ZIELE } from "@/lib/ki/logik";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { KiVorschlagAnzeige } from "./KiVorschlagAnzeige";

interface Option {
  id: string;
  label: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export function KiGeneratorForm({
  sprachen,
  niveaus,
  kursarten,
  kiAktiv,
  standardModell,
  canManageEinstellungen,
}: {
  sprachen: Option[];
  niveaus: Option[];
  kursarten: Option[];
  kiAktiv: boolean;
  standardModell: string;
  canManageEinstellungen: boolean;
}) {
  const [modus, setModus] = useState<"STRUKTUR" | "FREI">("STRUKTUR");
  const [genState, genAction] = useActionState(generiereKiLektionAction, idleKiGeneratorState);
  const [saveState, saveAction] = useActionState(speichereKiLektionAction, idleFormState);
  const vorschlag = genState.vorschlag;

  return (
    <div className="space-y-5">
      {!kiAktiv && (
        <div className="alert-info">
          Die KI ist noch nicht verbunden.{" "}
          {canManageEinstellungen ? (
            <a href="/stammdaten/ki-generator" className="font-medium underline">
              OpenRouter-Key jetzt in den Stammdaten hinterlegen →
            </a>
          ) : (
            "Bitte die Administration bitten, den OpenRouter-Key in den Stammdaten zu hinterlegen."
          )}
        </div>
      )}

      {/* ——— Schritt 1: Eingaben ——— */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">1. Lektion beschreiben</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Modell: <span className="font-medium">{standardModell}</span>
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-slate-50 p-0.5" role="group" aria-label="Modus">
            {(
              [
                ["STRUKTUR", "Strukturiert"],
                ["FREI", "Freier Prompt"],
              ] as const
            ).map(([wert, label]) => (
              <button
                key={wert}
                type="button"
                onClick={() => setModus(wert)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  modus === wert ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={modus === wert}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <form action={genAction} className="mt-4 space-y-4">
          <input type="hidden" name="modus" value={modus} />

          {modus === "STRUKTUR" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="spracheId" className="label">
                    Sprache <span className="text-brand-700">*</span>
                  </label>
                  <select id="spracheId" name="spracheId" className="input" defaultValue="">
                    <option value="" disabled>
                      Bitte wählen
                    </option>
                    {sprachen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={genState.fieldErrors?.spracheId} />
                </div>
                <div>
                  <label htmlFor="niveauId" className="label">
                    Niveau <span className="text-brand-700">*</span>
                  </label>
                  <select id="niveauId" name="niveauId" className="input" defaultValue="">
                    <option value="" disabled>
                      Bitte wählen
                    </option>
                    {niveaus.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={genState.fieldErrors?.niveauId} />
                </div>
                <div>
                  <label htmlFor="kursartId" className="label">
                    Kursart
                  </label>
                  <select id="kursartId" name="kursartId" className="input" defaultValue="">
                    <option value="">Ohne Angabe</option>
                    {kursarten.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="dauerMinuten" className="label">
                    Dauer (Minuten) <span className="text-brand-700">*</span>
                  </label>
                  <input
                    id="dauerMinuten"
                    name="dauerMinuten"
                    type="number"
                    min={15}
                    max={KI_MAX_DAUER_MINUTEN}
                    step={5}
                    defaultValue={60}
                    className="input"
                  />
                  <FieldError message={genState.fieldErrors?.dauerMinuten} />
                </div>
              </div>

              <div>
                <label htmlFor="lernziele" className="label">
                  Lernziele (eine Zeile pro Ziel, optional)
                </label>
                <textarea
                  id="lernziele"
                  name="lernziele"
                  rows={3}
                  maxLength={KI_MAX_ZIELE * 300}
                  className="input"
                  placeholder={"z. B. Wortschatz Ferien\nVergangenheitsform üben\nKurzes Rollenspiel"}
                />
              </div>

              <div>
                <label htmlFor="zusatzhinweise" className="label">
                  Zusätzliche Hinweise (optional)
                </label>
                <textarea
                  id="zusatzhinweise"
                  name="zusatzhinweise"
                  rows={2}
                  maxLength={1200}
                  className="input"
                  placeholder="z. B. Teilnehmende sind A1-Lernende, Fokus auf Sprechen, keine Hausaufgabe"
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="prompt" className="label">
                Auftrag an die KI <span className="text-brand-700">*</span>
              </label>
              <textarea
                id="prompt"
                name="prompt"
                rows={5}
                maxLength={8000}
                className="input"
                placeholder="Beschreibe die gewünschte Lektion oder Aufgabe so genau wie möglich …"
              />
              <FieldError message={genState.fieldErrors?.prompt} />
            </div>
          )}

          <FormAlert state={genState} />

          <div className="flex items-center gap-3">
            <SubmitButton pendingText="KI generiert …" disabled={!kiAktiv}>
              Vorschlag generieren
            </SubmitButton>
            <p className="text-xs text-slate-500">
              Der Vorschlag wird erst nach dem Speichern in der Bibliothek abgelegt.
            </p>
          </div>
        </form>
      </section>

      {/* ——— Schritt 2: Vorschlag prüfen + speichern ——— */}
      {vorschlag && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">2. Vorschlag prüfen und speichern</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Modell {vorschlag.modell}
            {vorschlag.tokenInput !== null && vorschlag.tokenOutput !== null
              ? ` · ${vorschlag.tokenInput} + ${vorschlag.tokenOutput} Tokens`
              : ""}
            {vorschlag.dauerMs ? ` · ${(vorschlag.dauerMs / 1000).toFixed(1)} s` : ""}
          </p>

          <div className="mt-4 rounded-lg border border-line bg-slate-50/60 p-4">
            <KiVorschlagAnzeige modus={vorschlag.modus} ergebnis={vorschlag.ergebnis} />
          </div>

          <form action={saveAction} className="mt-4 space-y-4">
            <input type="hidden" name="modus" value={vorschlag.modus} />
            <input type="hidden" name="prompt" value={vorschlag.prompt} />
            <input type="hidden" name="parameter" value={JSON.stringify(vorschlag.parameter)} />
            <input type="hidden" name="ergebnis" value={JSON.stringify(vorschlag.ergebnis)} />
            <input type="hidden" name="modell" value={vorschlag.modell} />
            <input type="hidden" name="tokenInput" value={vorschlag.tokenInput ?? ""} />
            <input type="hidden" name="tokenOutput" value={vorschlag.tokenOutput ?? ""} />
            <input type="hidden" name="dauerMs" value={vorschlag.dauerMs ?? ""} />
            <input type="hidden" name="spracheId" value={vorschlag.spracheId ?? ""} />
            <input type="hidden" name="niveauId" value={vorschlag.niveauId ?? ""} />
            <input type="hidden" name="kursartId" value={vorschlag.kursartId ?? ""} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="titel" className="label">
                  Titel <span className="text-brand-700">*</span>
                </label>
                <input
                  id="titel"
                  name="titel"
                  type="text"
                  defaultValue={vorschlag.titel}
                  maxLength={200}
                  className="input"
                />
                <FieldError message={saveState.fieldErrors?.titel} />
              </div>
              <div>
                <label htmlFor="thema" className="label">
                  Thema / Kurzbeschreibung
                </label>
                <input
                  id="thema"
                  name="thema"
                  type="text"
                  defaultValue={vorschlag.thema}
                  maxLength={1200}
                  className="input"
                />
              </div>
            </div>

            <FormAlert state={saveState} />
            <SubmitButton pendingText="Speichert …">In Bibliothek speichern</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
