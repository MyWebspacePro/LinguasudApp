"use client";

// Formulare/Aktionen des Aufgaben-Systems (Modul 13): anlegen/bearbeiten
// (Titel, Beschreibung, Zugewiesene:r, Fälligkeit, Verknüpfungen) sowie
// erledigen · wieder öffnen · löschen. Meldungen stehen bewusst über den
// bedingten Blöcken (revalidatePath zeichnet Sektionen neu).

import { useActionState } from "react";

import {
  erledigeAufgabeAction,
  loescheAufgabeAction,
  oeffneAufgabeWiederAction,
  saveAufgabeAction,
} from "@/lib/aufgaben/actions";
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

export interface AufgabeFormularDaten {
  id: string;
  titel: string;
  beschreibung: string | null;
  assigneeUserId: string | null;
  /** Fälligkeit als Date-Key "YYYY-MM-DD" oder null. */
  faelligAm: string | null;
  personId: string | null;
  kursId: string | null;
}

/** Aufgabe anlegen oder bearbeiten. */
export function AufgabeFormular({
  aufgabe,
  stabsPersonen,
  personen,
  kurse,
}: {
  aufgabe?: AufgabeFormularDaten;
  stabsPersonen: readonly OptionItem[];
  personen: readonly OptionItem[];
  kurse: readonly OptionItem[];
}) {
  const [state, formAction] = useActionState(saveAufgabeAction, idleFormState);
  const bearbeiten = Boolean(aufgabe);
  const idSuffix = aufgabe?.id ?? "neu";
  return (
    <form action={formAction} className="space-y-4">
      {aufgabe && <input type="hidden" name="id" value={aufgabe.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`a-titel-${idSuffix}`} className="label">
            Titel *
          </label>
          <input
            id={`a-titel-${idSuffix}`}
            name="titel"
            className="input"
            defaultValue={aufgabe?.titel ?? ""}
            placeholder="z.B. Herr Meier zum Probestunden-Termin anrufen"
            required
          />
          <FieldError message={state.fieldErrors?.titel} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`a-beschreibung-${idSuffix}`} className="label">
            Beschreibung
          </label>
          <textarea
            id={`a-beschreibung-${idSuffix}`}
            name="beschreibung"
            rows={3}
            className="input"
            defaultValue={aufgabe?.beschreibung ?? ""}
          />
        </div>
        <div>
          <label htmlFor={`a-assignee-${idSuffix}`} className="label">
            Zugewiesene:r
          </label>
          <select
            id={`a-assignee-${idSuffix}`}
            name="assigneeUserId"
            className="input"
            defaultValue={aufgabe?.assigneeUserId ?? ""}
          >
            <option value="">Unbeauftragt (Büro)</option>
            {stabsPersonen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`a-faellig-${idSuffix}`} className="label">
            Fälligkeit
          </label>
          <input
            id={`a-faellig-${idSuffix}`}
            name="faelligAm"
            type="date"
            className="input"
            defaultValue={aufgabe?.faelligAm ?? ""}
          />
          <FieldError message={state.fieldErrors?.faelligAm} />
        </div>
        <div>
          <label htmlFor={`a-person-${idSuffix}`} className="label">
            Verknüpfung: Person
          </label>
          <select id={`a-person-${idSuffix}`} name="personId" className="input" defaultValue={aufgabe?.personId ?? ""}>
            <option value="">— keine —</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`a-kurs-${idSuffix}`} className="label">
            Verknüpfung: Kurs
          </label>
          <select id={`a-kurs-${idSuffix}`} name="kursId" className="input" defaultValue={aufgabe?.kursId ?? ""}>
            <option value="">— keine —</option>
            {kurse.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          {bearbeiten ? "Speichern" : "Aufgabe anlegen"}
        </SubmitButton>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

/** Erledigen / wieder öffnen / löschen (Löschung mit Bestätigung). */
export function AufgabeAktionen({
  aufgabeId,
  status,
  titel,
}: {
  aufgabeId: string;
  status: string;
  titel: string;
}) {
  const [erledigtState, erledigtAction] = useActionState(erledigeAufgabeAction, idleFormState);
  const [oeffnenState, oeffnenAction] = useActionState(oeffneAufgabeWiederAction, idleFormState);
  const [loeschState, loeschAction] = useActionState(loescheAufgabeAction, idleFormState);
  const offen = status === "OFFEN";

  return (
    <div className="space-y-4">
      {/* Meldungen über den Blöcken: revalidatePath kann die Sektionen darunter neu zeichnen. */}
      <FormAlert state={erledigtState} />
      <FormAlert state={oeffnenState} />
      <FormAlert state={loeschState} />

      {offen ? (
        <form action={erledigtAction}>
          <input type="hidden" name="aufgabeId" value={aufgabeId} />
          <SubmitButton className="btn-primary" pendingText="…">
            Erledigt
          </SubmitButton>
        </form>
      ) : (
        <form action={oeffnenAction}>
          <input type="hidden" name="aufgabeId" value={aufgabeId} />
          <SubmitButton className="btn-secondary" pendingText="…">
            Wieder öffnen
          </SubmitButton>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form
          action={loeschAction}
          onSubmit={(e) => {
            if (!confirm(`Aufgabe «${titel}» endgültig löschen?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="aufgabeId" value={aufgabeId} />
          <SubmitButton className="btn-danger" pendingText="…">
            Aufgabe löschen
          </SubmitButton>
        </form>
        <p className="text-xs text-slate-500">
          Nach dem Löschen kann die Automatik (Anfrage, Paket-Ende, Anwesenheit) die Aufgabe erneut anlegen.
        </p>
      </div>
    </div>
  );
}
