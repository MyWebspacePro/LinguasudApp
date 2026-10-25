"use client";

// Formulare der Dienst- & Urlaubsplanung (Modul 8): Pensum-Block, Tages-
// Abweichung, Abwesenheit, Urlaubs-Kontingent — plus generische Lösch-Form.

import { useActionState, useState } from "react";
import {
  saveAbweichungAction,
  saveAbwesenheitAction,
  saveDienstAction,
  saveKontingentAction,
} from "@/lib/bueroplan/actions";
import { BUERO_ABWEICHUNG_LABELS, BUERO_ABWESENHEIT_LABELS } from "@/lib/bueroplan/logik";
import { idleFormState, type FormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { addDays, heuteDateKey } from "@/lib/zeit";

const WOCHENTAGE = [
  { value: "1", label: "Montag" },
  { value: "2", label: "Dienstag" },
  { value: "3", label: "Mittwoch" },
  { value: "4", label: "Donnerstag" },
  { value: "5", label: "Freitag" },
  { value: "6", label: "Samstag" },
  { value: "7", label: "Sonntag" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

/** Generische Lösch-Form (Server-Action als Prop, alle Felder hidden). */
export function LoeschForm({
  action,
  fields,
  label = "Entfernen",
  confirmText,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline"
    >
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">
        {label}
      </SubmitButton>
      {state.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

/** Neuer Pensum-Block im Wochenplan (beliebig viele Blöcke pro Tag). */
export function DienstForm({ personId }: { personId: string }) {
  const [state, formAction] = useActionState(saveDienstAction, idleFormState);
  return (
    <form action={formAction} className="rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="personId" value={personId} />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Zeitblock ins Pensum aufnehmen
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_auto_auto_1fr_auto]">
        <div>
          <label htmlFor="dienst-wochentag" className="label">
            Wochentag
          </label>
          <select id="dienst-wochentag" name="wochentag" required className="input" defaultValue="1">
            {WOCHENTAGE.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.wochentag} />
        </div>
        <div>
          <label htmlFor="dienst-start" className="label">
            Von
          </label>
          <input id="dienst-start" name="startZeit" type="time" required className="input" defaultValue="08:00" />
          <FieldError message={state.fieldErrors?.startZeit} />
        </div>
        <div>
          <label htmlFor="dienst-ende" className="label">
            Bis
          </label>
          <input id="dienst-ende" name="endZeit" type="time" required className="input" defaultValue="12:00" />
        </div>
        <div>
          <label htmlFor="dienst-notiz" className="label">
            Notiz (optional)
          </label>
          <input id="dienst-notiz" name="notiz" className="input" placeholder="z.B. 45 Min vor Unterricht" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Aufnehmen
          </SubmitButton>
        </div>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

/** Tages-Abweichung vom Pensum: abweichende Arbeitszeit oder dienstfrei. */
export function AbweichungForm({ personId }: { personId: string }) {
  const [state, formAction] = useActionState(saveAbweichungAction, idleFormState);
  const [art, setArt] = useState<"ARBEITSZEIT" | "FREI">("ARBEITSZEIT");
  return (
    <form action={formAction} className="rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="art" value={art} />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Abweichung an einem Tag eintragen
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_auto_auto_auto_1fr_auto]">
        <div>
          <label htmlFor="abweichung-datum" className="label">
            Datum
          </label>
          <input
            id="abweichung-datum"
            name="datum"
            type="date"
            required
            className="input"
            defaultValue={heuteDateKey()}
          />
          <FieldError message={state.fieldErrors?.datum} />
        </div>
        <div>
          <label htmlFor="abweichung-art" className="label">
            Art
          </label>
          <select
            id="abweichung-art"
            className="input"
            value={art}
            onChange={(e) => setArt(e.target.value as "ARBEITSZEIT" | "FREI")}
          >
            {(Object.keys(BUERO_ABWEICHUNG_LABELS) as ("ARBEITSZEIT" | "FREI")[]).map((a) => (
              <option key={a} value={a}>
                {BUERO_ABWEICHUNG_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        {art === "ARBEITSZEIT" && (
          <>
            <div>
              <label htmlFor="abweichung-start" className="label">
                Von
              </label>
              <input id="abweichung-start" name="startZeit" type="time" required className="input" defaultValue="08:00" />
              <FieldError message={state.fieldErrors?.startZeit} />
            </div>
            <div>
              <label htmlFor="abweichung-ende" className="label">
                Bis
              </label>
              <input id="abweichung-ende" name="endZeit" type="time" required className="input" defaultValue="12:00" />
            </div>
          </>
        )}
        <div>
          <label htmlFor="abweichung-notiz" className="label">
            Notiz (optional)
          </label>
          <input id="abweichung-notiz" name="notiz" className="input" placeholder="z.B. Vertretung, später Start" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Eintragen
          </SubmitButton>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {art === "ARBEITSZEIT"
          ? "Ersetzt die Pensum-Blöcke dieses Tages durch die angegebene Zeit."
          : "Der Tag ist dienstfrei — zählt nicht aufs Urlaubs-Kontingent (z.B. Kompensation)."}
      </p>
      <FormAlert state={state} />
    </form>
  );
}

/** Abwesenheit (Urlaub/Krankheit/sonstige) über einen Kalenderzeitraum. */
export function AbwesenheitForm({ personId }: { personId: string }) {
  const [state, formAction] = useActionState(saveAbwesenheitAction, idleFormState);
  return (
    <form action={formAction} className="rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="personId" value={personId} />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Abwesenheit eintragen (kein Genehmigungs-Workflow)
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_auto_auto_1fr_auto]">
        <div>
          <label htmlFor="abwesenheit-art" className="label">
            Art
          </label>
          <select id="abwesenheit-art" name="art" required className="input" defaultValue="URLAUB">
            {(Object.keys(BUERO_ABWESENHEIT_LABELS) as (keyof typeof BUERO_ABWESENHEIT_LABELS)[]).map((a) => (
              <option key={a} value={a}>
                {BUERO_ABWESENHEIT_LABELS[a]}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.art} />
        </div>
        <div>
          <label htmlFor="abwesenheit-von" className="label">
            Von (inklusive)
          </label>
          <input id="abwesenheit-von" name="von" type="date" required className="input" defaultValue={heuteDateKey()} />
          <FieldError message={state.fieldErrors?.von} />
        </div>
        <div>
          <label htmlFor="abwesenheit-bis" className="label">
            Bis (inklusive)
          </label>
          <input
            id="abwesenheit-bis"
            name="bis"
            type="date"
            required
            className="input"
            defaultValue={addDays(heuteDateKey(), 4)}
          />
          <FieldError message={state.fieldErrors?.bis} />
        </div>
        <div>
          <label htmlFor="abwesenheit-bemerkung" className="label">
            Bemerkung (optional)
          </label>
          <input id="abwesenheit-bemerkung" name="bemerkung" className="input" placeholder="z.B. Sommerferien" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Eintragen
          </SubmitButton>
        </div>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

/** Urlaubs-Kontingent eines Jahres anpassen (Default 20 Tage). */
export function KontingentForm({ personId }: { personId: string }) {
  const [state, formAction] = useActionState(saveKontingentAction, idleFormState);
  return (
    <form action={formAction} className="rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="personId" value={personId} />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Urlaubs-Kontingent eines Jahres anpassen
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
        <div>
          <label htmlFor="kontingent-jahr" className="label">
            Jahr
          </label>
          <input
            id="kontingent-jahr"
            name="jahr"
            type="number"
            min={2000}
            max={2100}
            required
            className="input"
            defaultValue={Number(heuteDateKey().slice(0, 4))}
          />
          <FieldError message={state.fieldErrors?.jahr} />
        </div>
        <div>
          <label htmlFor="kontingent-tage" className="label">
            Urlaubstage
          </label>
          <input id="kontingent-tage" name="tage" type="number" min={0} max={365} required className="input" defaultValue={20} />
          <FieldError message={state.fieldErrors?.tage} />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Speichern
          </SubmitButton>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Ohne eigenen Eintrag gilt der Standard von 20 Tagen pro Jahr.</p>
      <FormAlert state={state} />
    </form>
  );
}
