"use client";

// Formulare der Anfragen-Verwaltung (Modul 13): Statuswechsel (in Bearbeitung,
// ablehnen mit Grund, zurück auf offen), Zuordnung an eine bestehende Person
// oder an eine neu angelegte INTERESSENT-Person. Meldungen über den Blöcken.

import { useActionState } from "react";

import {
  erfasseAnfrageManuellAction,
  hebeAnfrageZuordnungAufAction,
  setzeAnfrageStatusAction,
  zuordneAnfrageNeuePersonAction,
  zuordneAnfragePersonAction,
} from "@/lib/anfragen/actions";
import { ANREDE_WERTE, ANREDE_LABELS } from "@/lib/domain";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export interface OptionItem {
  id: string;
  label: string;
}

/** Manuelle Anfrage-Erfassung durchs Büro (z.B. telefonischer Eingang). */
export function AnfrageErfassenForm({
  sprachen,
  niveaus,
}: {
  sprachen: readonly OptionItem[];
  niveaus: readonly OptionItem[];
}) {
  const [state, formAction] = useActionState(erfasseAnfrageManuellAction, idleFormState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <FormAlert state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="anf-neu-name" className="label">
            Name *
          </label>
          <input id="anf-neu-name" name="name" className="input" required placeholder="Vor- und Nachname" />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor="anf-neu-email" className="label">
            E-Mail *
          </label>
          <input id="anf-neu-email" name="email" type="email" className="input" required placeholder="name@beispiel.ch" />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div>
          <label htmlFor="anf-neu-telefon" className="label">
            Telefon
          </label>
          <input id="anf-neu-telefon" name="telefon" className="input" placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="anf-neu-sprache" className="label">
            Sprache
          </label>
          <select id="anf-neu-sprache" name="spracheId" className="input" defaultValue="">
            <option value="">Keine Angabe</option>
            {sprachen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="anf-neu-niveau" className="label">
            Gewünschtes Niveau
          </label>
          <select id="anf-neu-niveau" name="niveauId" className="input" defaultValue="">
            <option value="">Keine Angabe</option>
            {niveaus.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="anf-neu-nachricht" className="label">
          Notiz / Anliegen
        </label>
        <textarea
          id="anf-neu-nachricht"
          name="nachricht"
          className="input"
          rows={4}
          placeholder="z.B. Telefonnotiz: sucht Kurs ab Januar, zwei Abende pro Woche"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Erfasse …">
          Anfrage erfassen
        </SubmitButton>
        <p className="text-xs text-slate-500">
          Erscheint wie ein Website-Eingang als «offen» — ohne Bestätigungs-Mail an die Person.
        </p>
      </div>
    </form>
  );
}

/**
 * Statuswechsel einer Anfrage (ohne Zuordnung): in Bearbeitung, zurück auf
 * offen, ablehnen (mit Pflicht-Grund).
 */
export function AnfrageStatusAktionen({
  anfrageId,
  status,
}: {
  anfrageId: string;
  status: string;
}) {
  const [state, formAction] = useActionState(setzeAnfrageStatusAction, idleFormState);

  return (
    <div className="space-y-3">
      <FormAlert state={state} />
      <div className="flex flex-wrap items-center gap-2">
        {status === "OFFEN" && (
          <form action={formAction}>
            <input type="hidden" name="anfrageId" value={anfrageId} />
            <input type="hidden" name="status" value="IN_BEARBEITUNG" />
            <SubmitButton className="btn-secondary" pendingText="…">
              In Bearbeitung nehmen
            </SubmitButton>
          </form>
        )}
        {status === "IN_BEARBEITUNG" && (
          <form action={formAction}>
            <input type="hidden" name="anfrageId" value={anfrageId} />
            <input type="hidden" name="status" value="OFFEN" />
            <SubmitButton className="btn-secondary" pendingText="…">
              Zurück auf «offen»
            </SubmitButton>
          </form>
        )}
        {(status === "OFFEN" || status === "IN_BEARBEITUNG") && (
          <form action={formAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="anfrageId" value={anfrageId} />
            <input type="hidden" name="status" value="ABGELEHNT" />
            <div>
              <label htmlFor={`anf-ablehnung-${anfrageId}`} className="label">
                Ablehnen — Grund
              </label>
              <input
                id={`anf-ablehnung-${anfrageId}`}
                name="ablehnungsGrund"
                className="input"
                placeholder="z.B. Passender Kurs nicht verfügbar"
                required
              />
              <FieldError message={state.fieldErrors?.ablehnungsGrund} />
            </div>
            <div className="pb-0.5">
              <SubmitButton className="btn-danger" pendingText="…">
                Ablehnen
              </SubmitButton>
            </div>
          </form>
        )}
        {status === "ABGELEHNT" && (
          <form action={formAction}>
            <input type="hidden" name="anfrageId" value={anfrageId} />
            <input type="hidden" name="status" value="OFFEN" />
            <SubmitButton className="btn-secondary" pendingText="…">
              Wieder öffnen
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Zuordnung nach Identitätsprüfung: bestehende Person wählen oder eine neue
 * INTERESSENT-Person anlegen (Anrede/Vor-/Nachname aus der Anfrage vorbefüllt).
 */
export function AnfrageZuordnung({
  anfrageId,
  personen,
  nameVorschlag,
}: {
  anfrageId: string;
  personen: readonly OptionItem[];
  /** Heuristischer Vor-/Nachname-Vorschlag aus dem Anfrage-Namen. */
  nameVorschlag: { vorname: string; nachname: string };
}) {
  const [bestehendState, bestehendAction] = useActionState(zuordneAnfragePersonAction, idleFormState);
  const [neuState, neuAction] = useActionState(zuordneAnfrageNeuePersonAction, idleFormState);

  return (
    <div className="space-y-5">
      <FormAlert state={bestehendState} />
      <FormAlert state={neuState} />

      <div>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Bestehende Person zuordnen
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Erst nach Identitätsprüfung (Telefonat/E-Mail-Abgleich) zuordnen.
        </p>
        <form action={bestehendAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="anfrageId" value={anfrageId} />
          <div className="min-w-64">
            <label htmlFor={`anf-person-${anfrageId}`} className="label">
              Person (Kartei)
            </label>
            <select id={`anf-person-${anfrageId}`} name="personId" className="input" required defaultValue="">
              <option value="" disabled>
                Person wählen …
              </option>
              {personen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <FieldError message={bestehendState.fieldErrors?.personId} />
          </div>
          <div className="pb-0.5">
            <SubmitButton className="btn-primary" pendingText="…">
              Zuordnen
            </SubmitButton>
          </div>
        </form>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Neue Interessent/in anlegen
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Legt eine Person mit Status «Interessent/in» an und übernimmt E-Mail/Telefon aus der Anfrage.
        </p>
        <form action={neuAction} className="mt-2 grid gap-2 sm:grid-cols-4 sm:items-end">
          <input type="hidden" name="anfrageId" value={anfrageId} />
          <div>
            <label htmlFor={`anf-anrede-${anfrageId}`} className="label">
              Anrede *
            </label>
            <select
              id={`anf-anrede-${anfrageId}`}
              name="anrede"
              className="input"
              defaultValue={nameVorschlag.vorname || nameVorschlag.nachname ? "" : "DIVERS"}
              required
            >
              <option value="" disabled>
                Anrede …
              </option>
              {ANREDE_WERTE.map((w) => (
                <option key={w} value={w}>
                  {ANREDE_LABELS[w]}
                </option>
              ))}
            </select>
            <FieldError message={neuState.fieldErrors?.anrede} />
          </div>
          <div>
            <label htmlFor={`anf-vorname-${anfrageId}`} className="label">
              Vorname *
            </label>
            <input
              id={`anf-vorname-${anfrageId}`}
              name="vorname"
              className="input"
              defaultValue={nameVorschlag.vorname}
              required
            />
            <FieldError message={neuState.fieldErrors?.vorname} />
          </div>
          <div>
            <label htmlFor={`anf-nachname-${anfrageId}`} className="label">
              Nachname *
            </label>
            <input
              id={`anf-nachname-${anfrageId}`}
              name="nachname"
              className="input"
              defaultValue={nameVorschlag.nachname}
              required
            />
            <FieldError message={neuState.fieldErrors?.nachname} />
          </div>
          <div className="pb-0.5">
            <SubmitButton className="btn-secondary" pendingText="Legt an…">
              Anlegen &amp; zuordnen
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Zuordnung aufheben (zurück in Bearbeitung). */
export function AnfrageZuordnungAufheben({ anfrageId }: { anfrageId: string }) {
  const [state, formAction] = useActionState(hebeAnfrageZuordnungAufAction, idleFormState);
  return (
    <div className="space-y-3">
      <FormAlert state={state} />
      <form action={formAction}>
        <input type="hidden" name="anfrageId" value={anfrageId} />
        <SubmitButton className="btn-secondary" pendingText="…">
          Zuordnung aufheben
        </SubmitButton>
      </form>
    </div>
  );
}
