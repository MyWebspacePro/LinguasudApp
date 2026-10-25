"use client";

// Formulare der Rechnungsverwaltung (Modul 9): neue Rechnung (Empfänger +
// dynamische Positionen), Entwurf bearbeiten, Versenden, Teilzahlung,
// Storno, Mahnung, Entwurf löschen.

import { useActionState, useState } from "react";
import {
  erfasseZahlungAction,
  erstelleRechnungAction,
  loescheEntwurfAction,
  sendeMahnungAction,
  storniereRechnungAction,
  updateEntwurfAction,
} from "@/lib/rechnungen/actions";
import { betragZahl } from "@/lib/rechnungen/logik";
import { idleFormState, type FormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

interface PositionZeile {
  text: string;
  menge: string;
  preis: string;
}

const leerZeile = (): PositionZeile => ({ text: "", menge: "1", preis: "" });

function zeilenSumme(zeilen: readonly PositionZeile[]): string {
  const total = zeilen.reduce((summe, z) => summe + betragZahl(z.preis) * (Number.parseInt(z.menge, 10) || 0), 0);
  return total.toFixed(2);
}

/**
 * Dynamische Positions-Zeilen (Paket, Lehrmittel, Registration …):
 * jedes Rendering-Paar text/menge/preis trägt den Index im Feldnamen.
 */
function PositionenEingabe({ zeilen, setZeilen }: { zeilen: PositionZeile[]; setZeilen: (z: PositionZeile[]) => void }) {
  return (
    <div className="space-y-2">
      {zeilen.map((zeile, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_80px_130px_120px_auto]">
          <input
            name={`positionText${index}`}
            value={zeile.text}
            onChange={(e) => setZeilen(zeilen.map((z, i) => (i === index ? { ...z, text: e.target.value } : z)))}
            placeholder={index === 0 ? "Paket 14 Lektionen — Kurs DE-B2-…" : "Lehrmittel, Registration …"}
            className="input"
          />
          <input
            name={`positionMenge${index}`}
            type="number"
            min={1}
            max={999}
            value={zeile.menge}
            onChange={(e) => setZeilen(zeilen.map((z, i) => (i === index ? { ...z, menge: e.target.value } : z)))}
            className="input"
            aria-label={`Menge Position ${index + 1}`}
          />
          <input
            name={`positionPreis${index}`}
            type="number"
            step="0.01"
            min={0}
            value={zeile.preis}
            onChange={(e) => setZeilen(zeilen.map((z, i) => (i === index ? { ...z, preis: e.target.value } : z)))}
            placeholder="0.00"
            className="input"
            aria-label={`Einzelpreis Position ${index + 1}`}
          />
          <span className="flex items-center px-1 text-sm tabular-nums text-slate-600">
            {(betragZahl(zeile.preis) * (Number.parseInt(zeile.menge, 10) || 0)).toFixed(2)} CHF
          </span>
          <button
            type="button"
            onClick={() => setZeilen(zeilen.filter((_, i) => i !== index))}
            className="btn-secondary px-2 py-1 text-xs"
            disabled={zeilen.length === 1}
            title="Position entfernen"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setZeilen([...zeilen, leerZeile()])} className="btn-secondary px-2.5 py-1 text-xs">
          + Position
        </button>
        <span className="text-sm font-semibold text-slate-800">Summe: {zeilenSumme(zeilen)} CHF</span>
      </div>
    </div>
  );
}

export interface EmpfaengerOption {
  id: string;
  label: string;
  typ: "person" | "kostentraeger";
}

/** Neue Rechnung (manuell durchs Büro — auch Behörden im Nachhinein). */
export function NeueRechnungForm({ optionen }: { optionen: readonly EmpfaengerOption[] }) {
  const [state, formAction] = useActionState(erstelleRechnungAction, idleFormState);
  const [zeilen, setZeilen] = useState<PositionZeile[]>([leerZeile()]);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="rechnung-empfaenger" className="label">
          Empfänger (Person, Firma oder Behörde)
        </label>
        <select id="rechnung-empfaenger" name="empfaengerId" required className="input" defaultValue="">
          <option value="" disabled>
            Empfänger wählen …
          </option>
          <optgroup label="Personen (privat / Eltern als Empfänger)">
            {optionen
              .filter((o) => o.typ === "person")
              .map((o) => (
                <option key={o.id} value={`person:${o.id}`}>
                  {o.label}
                </option>
              ))}
          </optgroup>
          <optgroup label="Kostenträger (Firma / öffentliche Einrichtung)">
            {optionen
              .filter((o) => o.typ === "kostentraeger")
              .map((o) => (
                <option key={o.id} value={`kostentraeger:${o.id}`}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        </select>
        <FieldError message={state.fieldErrors?.empfaengerId} />
      </div>

      <div>
        <p className="label">Positionen</p>
        <PositionenEingabe zeilen={zeilen} setZeilen={setZeilen} />
        <FieldError message={state.fieldErrors?.positionen} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor="rechnung-mwst" className="label">
            MwSt-Satz % (leer = MwSt-frei)
          </label>
          <input
            id="rechnung-mwst"
            name="mwstSatzProzent"
            type="number"
            step="0.1"
            min={0}
            max={20}
            className="input"
            placeholder="z.B. 8.1"
          />
          <FieldError message={state.fieldErrors?.mwstSatzProzent} />
        </div>
        <div>
          <label htmlFor="rechnung-notiz" className="label">
            Notiz auf der Rechnung (optional)
          </label>
          <input id="rechnung-notiz" name="notiz" className="input" placeholder="z.B. Behördenrechnung nach Leistungserbringung" />
        </div>
      </div>

      <FormAlert state={state} />
      <SubmitButton className="btn-primary" pendingText="Erstelle …">
        Rechnung erstellen (Entwurf)
      </SubmitButton>
    </form>
  );
}

/** Entwurf bearbeiten: Positionen, MwSt, Notiz und Zahlungsfrist. */
export function EntwurfBearbeitenForm({
  rechnungId,
  positionen,
  mwstSatzProzent,
  notiz,
}: {
  rechnungId: string;
  positionen: readonly PositionZeile[];
  mwstSatzProzent: number | null;
  notiz: string | null;
}) {
  const [state, formAction] = useActionState(updateEntwurfAction, idleFormState);
  const [zeilen, setZeilen] = useState<PositionZeile[]>(positionen.length > 0 ? [...positionen] : [leerZeile()]);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="rechnungId" value={rechnungId} />
      <PositionenEingabe zeilen={zeilen} setZeilen={setZeilen} />
      <FieldError message={state.fieldErrors?.positionen} />
      <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr]">
        <div>
          <label htmlFor="entwurf-mwst" className="label">
            MwSt-Satz % (leer = frei)
          </label>
          <input
            id="entwurf-mwst"
            name="mwstSatzProzent"
            type="number"
            step="0.1"
            min={0}
            max={20}
            className="input"
            defaultValue={mwstSatzProzent ?? ""}
          />
        </div>
        <div>
          <label htmlFor="entwurf-frist" className="label">
            Zahlungsfrist (Tage)
          </label>
          <input id="entwurf-frist" name="zahlungsfristTage" type="number" min={1} max={365} defaultValue={30} className="input" />
          <FieldError message={state.fieldErrors?.zahlungsfristTage} />
        </div>
        <div>
          <label htmlFor="entwurf-notiz" className="label">
            Notiz (optional)
          </label>
          <input id="entwurf-notiz" name="notiz" className="input" defaultValue={notiz ?? ""} />
        </div>
      </div>
      <FormAlert state={state} />
      <SubmitButton className="btn-primary" pendingText="Speichere …">
        Entwurf speichern
      </SubmitButton>
    </form>
  );
}

/** Generische Ein-Feld-Form (Versenden, Storno, Mahnung, Zahlung, Löschen). */
export function RechnungAktionForm({
  action,
  fields,
  label,
  confirmText,
  className = "btn-secondary",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  confirmText?: string;
  className?: string;
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
      <SubmitButton className={className} pendingText="…">
        {label}
      </SubmitButton>
      {state.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
      {state.success && <span className="ml-2 text-xs text-emerald-700">{state.success}</span>}
    </form>
  );
}

/** Teilzahlung erfassen (Restbetrag wird geprüft, Status folgt automatisch). */
export function ZahlungForm({ rechnungId, restbetragChf }: { rechnungId: string; restbetragChf: string }) {
  const [state, formAction] = useActionState(erfasseZahlungAction, idleFormState);
  return (
    <form action={formAction} className="rounded-lg bg-slate-50 p-3">
      <input type="hidden" name="rechnungId" value={rechnungId} />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Zahlung erfassen (Restbetrag {Number(restbetragChf).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF)
      </p>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
        <div>
          <label htmlFor="zahlung-betrag" className="label">
            Betrag CHF
          </label>
          <input
            id="zahlung-betrag"
            name="betragChf"
            type="number"
            step="0.01"
            min={0.05}
            max={Number(restbetragChf)}
            required
            className="input"
            defaultValue={restbetragChf}
          />
          <FieldError message={state.fieldErrors?.betragChf} />
        </div>
        <div>
          <label htmlFor="zahlung-bemerkung" className="label">
            Bemerkung (optional)
          </label>
          <input id="zahlung-bemerkung" name="bemerkung" className="input" placeholder="z.B. TWINT, Bank" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-primary" pendingText="…">
            Erfassen
          </SubmitButton>
        </div>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

/** Storno mit Grund (Pflicht). */
export function StornoForm({ rechnungId }: { rechnungId: string }) {
  const [state, formAction] = useActionState(storniereRechnungAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Rechnung wirklich stornieren? Dies kann nicht rückgängig gemacht werden.")) e.preventDefault();
      }}
      className="inline-flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="rechnungId" value={rechnungId} />
      <div>
        <label htmlFor="storno-grund" className="sr-only">
          Storno-Grund
        </label>
        <input id="storno-grund" name="grund" className="input" placeholder="Storno-Grund" required minLength={3} />
      </div>
      <SubmitButton className="btn-secondary" pendingText="…">
        Stornieren
      </SubmitButton>
      <FieldError message={state.fieldErrors?.grund} />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

/** Mahn-Stufe manuell versenden (freundliche Erinnerung / Mahnung). */
export function MahnungForm({ rechnungId, naechsteStufe }: { rechnungId: string; naechsteStufe: 1 | 2 | null }) {
  const [state, formAction] = useActionState(sendeMahnungAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Mahn-Stufe ${naechsteStufe} jetzt per E-Mail versenden?`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="rechnungId" value={rechnungId} />
      <SubmitButton className="btn-secondary" pendingText="…" >
        {naechsteStufe === 1 ? "Erinnerung versenden" : "Mahnung (Stufe 2) versenden"}
      </SubmitButton>
      {state.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

/** Entwurf löschen (nur Status ENTWURF). */
export function EntwurfLoeschForm({ rechnungId }: { rechnungId: string }) {
  const [state, formAction] = useActionState(loescheEntwurfAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Entwurf endgültig löschen?")) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="rechnungId" value={rechnungId} />
      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">
        Löschen
      </SubmitButton>
      {state.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
