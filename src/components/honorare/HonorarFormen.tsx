"use client";

// Formulare der Honorarabrechnung (Modul 11): Default-Stundensatz (nur
// Admin), Honorar-Matrix (Satz setzen/löschen) und Monats-Workflow
// («als bezahlt markieren», wieder öffnen).

import { useActionState } from "react";
import {
  loescheHonorarSatzAction,
  markiereHonorarBezahltAction,
  oeffneHonorarAction,
  saveHonorarSatzAction,
  speichereDefaultStundensatzAction,
} from "@/lib/honorare/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

/** Globaler Default-Stundensatz — Vorbelegung für alle ohne Abweichung. */
export function DefaultSatzForm({ stundensatz, canManage }: { stundensatz: string; canManage: boolean }) {
  const [state, formAction] = useActionState(speichereDefaultStundensatzAction, idleFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="default-stundensatz" className="label">
          Default-Stundensatz (CHF/h)
        </label>
        <input
          id="default-stundensatz"
          name="stundensatz"
          type="number"
          step="0.05"
          min={0}
          max={1000}
          defaultValue={stundensatz}
          className="input w-36"
          disabled={!canManage}
          required
        />
        <FieldError message={state.fieldErrors?.stundensatz} />
      </div>
      {canManage ? (
        <SubmitButton className="btn-primary" pendingText="Speichert …">
          Speichern
        </SubmitButton>
      ) : (
        <span className="pb-2 text-xs text-slate-500">nur Admin</span>
      )}
      {state.error ? <span className="pb-2 text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="pb-2 text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

/** Satz der Honorar-Matrix setzen/überschreiben (Lehrperson × Kursart × Dauer). */
export function HonorarSatzForm({
  lehrpersonen,
  kursarten,
  dauern,
  vorwahlLehrpersonId,
}: {
  lehrpersonen: { id: string; name: string }[];
  kursarten: { id: string; name: string }[];
  dauern: number[];
  vorwahlLehrpersonId?: string;
}) {
  const [state, formAction] = useActionState(saveHonorarSatzAction, idleFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="satz-lehrperson" className="label">
            Lehrperson
          </label>
          <select
            id="satz-lehrperson"
            name="lehrpersonId"
            className="input"
            defaultValue={vorwahlLehrpersonId ?? ""}
            required
          >
            <option value="" disabled>
              wählen …
            </option>
            {lehrpersonen.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.lehrpersonId} />
        </div>
        <div>
          <label htmlFor="satz-kursart" className="label">
            Kursart
          </label>
          <select id="satz-kursart" name="kursartId" className="input" required defaultValue="">
            <option value="" disabled>
              wählen …
            </option>
            {kursarten.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.kursartId} />
        </div>
        <div>
          <label htmlFor="satz-minuten" className="label">
            Lektionsdauer
          </label>
          <select id="satz-minuten" name="minuten" className="input" required defaultValue="">
            <option value="" disabled>
              wählen …
            </option>
            {dauern.map((m) => (
              <option key={m} value={m}>
                {m} Min
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.minuten} />
        </div>
        <div>
          <label htmlFor="satz-stundensatz" className="label">
            Stundensatz (CHF/h)
          </label>
          <input
            id="satz-stundensatz"
            name="stundensatz"
            type="number"
            step="0.05"
            min={0}
            max={1000}
            placeholder="40.00"
            className="input"
            required
          />
          <FieldError message={state.fieldErrors?.stundensatz} />
        </div>
        <div className="flex items-end">
          <SubmitButton className="btn-primary" pendingText="Speichert …">
            Satz speichern
          </SubmitButton>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Ein bestehender Satz wird überschrieben. Ohne Abweichung gilt der Default-Stundensatz; die
        Lektionsdauer wird hochgerechnet (Stundensatz × Minuten/60, gerundet auf 5 Rappen).
      </p>
    </form>
  );
}

/** Einzelnen Matrix-Satz löschen — danach gilt wieder der Default. */
export function HonorarSatzLoeschen({ satzId }: { satzId: string }) {
  const [state, formAction] = useActionState(loescheHonorarSatzAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Diesen Honorar-Satz löschen? Danach gilt wieder der Default-Stundensatz.")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="satzId" value={satzId} />
      <SubmitButton className="text-xs text-slate-400 transition hover:text-red-600" pendingText="…">
        ✕
      </SubmitButton>
      {state.error ? <span className="ml-1 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

/** Monat als bezahlt markieren (Snapshot von Total und Lektionszahl). */
export function HonorarMarkieren({
  lehrpersonId,
  monat,
  totalChf,
  anzahl,
  ohneSatz,
}: {
  lehrpersonId: string;
  monat: string;
  totalChf: string;
  anzahl: number;
  ohneSatz: number;
}) {
  const [state, formAction] = useActionState(markiereHonorarBezahltAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Honorar von CHF ${totalChf} für ${monat} als bezahlt markieren?`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="lehrpersonId" value={lehrpersonId} />
      <input type="hidden" name="monat" value={monat} />
      <input type="hidden" name="total" value={totalChf} />
      <input type="hidden" name="anzahl" value={anzahl} />
      <SubmitButton
        className="btn-primary px-2.5 py-1 text-xs"
        pendingText="…"
        disabled={anzahl === 0 || ohneSatz > 0}
        title={ohneSatz > 0 ? "Lektionen ohne Honorar-Satz — zuerst Matrix ergänzen" : undefined}
      >
        Als bezahlt markieren
      </SubmitButton>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="ml-2 text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

/** Bereits markierten Monat wieder öffnen (Korrekturfälle). */
export function HonorarWiederOeffnen({
  lehrpersonId,
  monat,
}: {
  lehrpersonId: string;
  monat: string;
}) {
  const [state, formAction] = useActionState(oeffneHonorarAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Abrechnung wieder öffnen? Der Status «bezahlt» wird zurückgesetzt.")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="lehrpersonId" value={lehrpersonId} />
      <input type="hidden" name="monat" value={monat} />
      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">
        Wieder öffnen
      </SubmitButton>
      {state.error ? <span className="ml-2 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
