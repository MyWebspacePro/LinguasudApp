"use client";

import { useActionState, useState } from "react";
import type { Anrede, PersonStatus } from "@/lib/domain";
import { ANREDE_LABELS, ANREDE_WERTE, PERSON_STATUS_LABELS, PERSON_STATUS_WERTE } from "@/lib/domain";
import { savePersonAction } from "@/lib/personen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

/** Serialisierte Person für das Formular (Server → Client). */
export interface PersonFormData {
  id: string | null;
  status: PersonStatus;
  anrede: Anrede;
  vorname: string;
  nachname: string;
  email: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  rechnungStrasse: string | null;
  rechnungPlz: string | null;
  rechnungOrt: string | null;
  telefon1: string | null;
  whatsapp1: boolean;
  signal1: boolean;
  telefon2: string | null;
  whatsapp2: boolean;
  signal2: boolean;
  istLehrperson: boolean;
  kuerzel: string | null;
  hasLinkedUser: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

/**
 * Person-Stammdaten (anlegen/bearbeiten): Anrede zwingend, Name, E-Mail
 * (= Login bei verknüpftem Konto), Status, Postadresse, abweichende
 * Rechnungsadresse, 2 Telefone mit WhatsApp/Signal, Lehrperson-Führung.
 */
export function PersonForm({ person }: { person?: PersonFormData | null }) {
  const isEdit = Boolean(person?.id);
  const idSuffix = person?.id ?? "neu";
  const [state, formAction] = useActionState(savePersonAction, idleFormState);
  const [istLehrperson, setIstLehrperson] = useState(person?.istLehrperson ?? false);
  const [rechnungAbweichend, setRechnungAbweichend] = useState(
    Boolean(person?.rechnungStrasse || person?.rechnungPlz || person?.rechnungOrt),
  );

  return (
    <form action={formAction} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={person!.id ?? ""} />}
      <FormAlert state={state} />

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Person</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor={`anrede-${idSuffix}`} className="label">
              Anrede / Geschlecht
            </label>
            <select
              id={`anrede-${idSuffix}`}
              name="anrede"
              required
              defaultValue={person?.anrede ?? ""}
              className="input"
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {ANREDE_WERTE.map((a) => (
                <option key={a} value={a}>
                  {ANREDE_LABELS[a]}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.anrede} />
          </div>
          <div>
            <label htmlFor={`vorname-${idSuffix}`} className="label">
              Vorname
            </label>
            <input
              id={`vorname-${idSuffix}`}
              name="vorname"
              defaultValue={person?.vorname ?? ""}
              required
              className="input"
            />
            <FieldError message={state.fieldErrors?.vorname} />
          </div>
          <div>
            <label htmlFor={`nachname-${idSuffix}`} className="label">
              Nachname
            </label>
            <input
              id={`nachname-${idSuffix}`}
              name="nachname"
              defaultValue={person?.nachname ?? ""}
              required
              className="input"
            />
            <FieldError message={state.fieldErrors?.nachname} />
          </div>
          <div>
            <label htmlFor={`email-${idSuffix}`} className="label">
              E-Mail {person?.hasLinkedUser ? "(= Login)" : "(optional)"}
            </label>
            <input
              id={`email-${idSuffix}`}
              name="email"
              type="email"
              defaultValue={person?.email ?? ""}
              className="input"
            />
            {person?.hasLinkedUser ? (
              <p className="mt-1 text-xs text-slate-500">
                Verknüpftes Konto vorhanden — die E-Mail bleibt automatisch mit dem Login synchron.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Bei Kontoverknüpfung wird daraus der Login.
              </p>
            )}
            <FieldError message={state.fieldErrors?.email} />
          </div>
          <div>
            <label htmlFor={`status-${idSuffix}`} className="label">
              Status
            </label>
            <select
              id={`status-${idSuffix}`}
              name="status"
              defaultValue={person?.status ?? "INTERESSENT"}
              className="input"
            >
              {PERSON_STATUS_WERTE.map((s) => (
                <option key={s} value={s}>
                  {PERSON_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Interessent/in wird bei der Anmeldung weiterverwendet.</p>
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="istLehrperson"
                checked={istLehrperson}
                onChange={(e) => setIstLehrperson(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-700"
              />
              <span>
                Als Lehrperson führen
                {istLehrperson && person?.kuerzel ? (
                  <span className="block font-mono text-xs font-semibold text-brand-700">
                    Kürzel: {person.kuerzel}
                  </span>
                ) : istLehrperson ? (
                  <span className="block text-xs text-slate-500">
                    Kürzel wird beim Speichern automatisch aus Vor-/Nachname erzeugt.
                  </span>
                ) : null}
              </span>
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Postadresse & Telefon
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor={`strasse-${idSuffix}`} className="label">
              Strasse
            </label>
            <input id={`strasse-${idSuffix}`} name="strasse" defaultValue={person?.strasse ?? ""} className="input" />
          </div>
          <div>
            <label htmlFor={`plz-${idSuffix}`} className="label">
              PLZ
            </label>
            <input id={`plz-${idSuffix}`} name="plz" defaultValue={person?.plz ?? ""} className="input" />
          </div>
          <div>
            <label htmlFor={`ort-${idSuffix}`} className="label">
              Ort
            </label>
            <input id={`ort-${idSuffix}`} name="ort" defaultValue={person?.ort ?? ""} className="input" />
          </div>
          <div>
            <label htmlFor={`telefon1-${idSuffix}`} className="label">
              Telefon 1
            </label>
            <input
              id={`telefon1-${idSuffix}`}
              name="telefon1"
              type="tel"
              defaultValue={person?.telefon1 ?? ""}
              className="input"
            />
            <div className="mt-1.5 flex gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="whatsapp1"
                  defaultChecked={person?.whatsapp1 ?? false}
                  className="h-3.5 w-3.5 accent-brand-700"
                />
                nutzt WhatsApp
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="signal1"
                  defaultChecked={person?.signal1 ?? false}
                  className="h-3.5 w-3.5 accent-brand-700"
                />
                nutzt Signal
              </label>
            </div>
          </div>
          <div>
            <label htmlFor={`telefon2-${idSuffix}`} className="label">
              Telefon 2
            </label>
            <input
              id={`telefon2-${idSuffix}`}
              name="telefon2"
              type="tel"
              defaultValue={person?.telefon2 ?? ""}
              className="input"
            />
            <div className="mt-1.5 flex gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="whatsapp2"
                  defaultChecked={person?.whatsapp2 ?? false}
                  className="h-3.5 w-3.5 accent-brand-700"
                />
                nutzt WhatsApp
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="signal2"
                  defaultChecked={person?.signal2 ?? false}
                  className="h-3.5 w-3.5 accent-brand-700"
                />
                nutzt Signal
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Rechnungsadresse
        </legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="rechnungAbweichend"
            checked={rechnungAbweichend}
            onChange={(e) => setRechnungAbweichend(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Weicht von der Postadresse ab
        </label>
        {rechnungAbweichend && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor={`rstrasse-${idSuffix}`} className="label">
                Strasse
              </label>
              <input
                id={`rstrasse-${idSuffix}`}
                name="rechnungStrasse"
                defaultValue={person?.rechnungStrasse ?? ""}
                className="input"
              />
            </div>
            <div>
              <label htmlFor={`rplz-${idSuffix}`} className="label">
                PLZ
              </label>
              <input
                id={`rplz-${idSuffix}`}
                name="rechnungPlz"
                defaultValue={person?.rechnungPlz ?? ""}
                className="input"
              />
            </div>
            <div>
              <label htmlFor={`rort-${idSuffix}`} className="label">
                Ort
              </label>
              <input
                id={`rort-${idSuffix}`}
                name="rechnungOrt"
                defaultValue={person?.rechnungOrt ?? ""}
                className="input"
              />
            </div>
          </div>
        )}
      </fieldset>

      <SubmitButton>{isEdit ? "Änderungen speichern" : "Person anlegen"}</SubmitButton>
    </form>
  );
}
