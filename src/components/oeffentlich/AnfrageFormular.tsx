"use client";

// Öffentliches Anfrage-Formular (Modul 13): Kontaktangaben plus gewünschte
// Sprache/Niveau; mit Empfehlung aus dem Einstufungstest vorbelegt (editierbar).
// Das versteckte «website»-Feld ist ein Honeypot gegen Bots.

import { useActionState } from "react";

import { anfrageAbsendenAction } from "@/lib/anfragen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export interface AnfrageVorbefuellung {
  spracheId: string;
  niveauId: string;
  /** Kompaktes Test-Resultat ("A1:3/3~A2:2/3") oder leer. */
  res: string;
  /** Begründungstext der Empfehlung (nur Anzeige). */
  empfehlungHinweis: string | null;
}

export function OeffentlichesAnfrageFormular({
  sprachen,
  niveaus,
  vorbefuellung,
}: {
  sprachen: { id: string; name: string }[];
  niveaus: { id: string; code: string }[];
  vorbefuellung: AnfrageVorbefuellung;
}) {
  const [state, formAction] = useActionState(anfrageAbsendenAction, idleFormState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <input type="hidden" name="res" value={vorbefuellung.res} />
      {/* Honeypot — echte Besucher sehen und füllen dieses Feld nie aus. */}
      <input type="text" name="website" value="" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

      {vorbefuellung.empfehlungHinweis && (
        <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {vorbefuellung.empfehlungHinweis}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="oa-name" className="label">
            Name *
          </label>
          <input id="oa-name" name="name" className="input" required autoComplete="name" placeholder="Vor- und Nachname" />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor="oa-email" className="label">
            E-Mail *
          </label>
          <input id="oa-email" name="email" type="email" className="input" required autoComplete="email" />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div>
          <label htmlFor="oa-telefon" className="label">
            Telefon
          </label>
          <input id="oa-telefon" name="telefon" className="input" autoComplete="tel" placeholder="+41 …" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="oa-sprache" className="label">
              Sprache
            </label>
            <select id="oa-sprache" name="spracheId" className="input" defaultValue={vorbefuellung.spracheId}>
              <option value="">Offen / Beratung</option>
              {sprachen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="oa-niveau" className="label">
              Niveau
            </label>
            <select id="oa-niveau" name="niveauId" className="input" defaultValue={vorbefuellung.niveauId}>
              <option value="">Unsicher / Beratung</option>
              {niveaus.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="oa-nachricht" className="label">
          Nachricht
        </label>
        <textarea
          id="oa-nachricht"
          name="nachricht"
          rows={4}
          className="input"
          placeholder="Was möchten Sie lernen? Wann hätten Sie Zeit?"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Sendet…">
          Anfrage absenden
        </SubmitButton>
        <FormAlert state={state} />
      </div>
      <p className="text-xs text-slate-500">
        Wir verwenden Ihre Angaben ausschliesslich zur Beantwortung Ihrer Anfrage.
      </p>
    </form>
  );
}
