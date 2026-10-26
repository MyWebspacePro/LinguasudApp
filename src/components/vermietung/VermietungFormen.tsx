"use client";

// Formulare der Raumvermietung (Modul 12): Mieterkartei (neu/bearbeiten/
// archivieren/löschen), einmalige Vermietungen, Serien (materialisieren
// direkt beim Anlegen) und der Rechnungs-Entwurf über Modul 9.

import { useActionState } from "react";
import {
  aendereVermietungStatusAction,
  archiviereMieterAction,
  erstelleVermietungRechnungAction,
  loescheMieterAction,
  loescheVermietungAction,
  sageVermietungAbAction,
  saveMieterAction,
  saveSerieAction,
  saveVermietungAction,
} from "@/lib/vermietung/actions";
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

// ——— Mieterkartei ————————————————————————————————————————————————————

export interface MieterDaten {
  id: string;
  name: string;
  email: string | null;
  telefon: string | null;
  strasse: string;
  plz: string;
  ort: string;
  notiz: string | null;
}

/** Mieter anlegen oder bearbeiten (Name, Kontakt, Rechnungsadresse). */
export function MieterFormular({ mieter }: { mieter?: MieterDaten }) {
  const [state, formAction] = useActionState(saveMieterAction, idleFormState);
  const bearbeiten = Boolean(mieter);
  return (
    <form action={formAction} className="space-y-3">
      {mieter && <input type="hidden" name="id" value={mieter.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`mieter-name-${mieter?.id ?? "neu"}`} className="label">
            Name *
          </label>
          <input
            id={`mieter-name-${mieter?.id ?? "neu"}`}
            name="name"
            className="input"
            defaultValue={mieter?.name ?? ""}
            placeholder="z.B. Musikverein Armonia"
            required
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor={`mieter-email-${mieter?.id ?? "neu"}`} className="label">
            E-Mail (Rechnungsversand)
          </label>
          <input
            id={`mieter-email-${mieter?.id ?? "neu"}`}
            name="email"
            type="email"
            className="input"
            defaultValue={mieter?.email ?? ""}
            placeholder="kontakt@verein.ch"
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div>
          <label htmlFor={`mieter-telefon-${mieter?.id ?? "neu"}`} className="label">
            Telefon
          </label>
          <input
            id={`mieter-telefon-${mieter?.id ?? "neu"}`}
            name="telefon"
            className="input"
            defaultValue={mieter?.telefon ?? ""}
            placeholder="+41 …"
          />
        </div>
        <div className="grid grid-cols-[1fr_110px_1fr] gap-2 sm:col-span-2">
          <div>
            <label htmlFor={`mieter-strasse-${mieter?.id ?? "neu"}`} className="label">
              Strasse *
            </label>
            <input
              id={`mieter-strasse-${mieter?.id ?? "neu"}`}
              name="strasse"
              className="input"
              defaultValue={mieter?.strasse ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.strasse} />
          </div>
          <div>
            <label htmlFor={`mieter-plz-${mieter?.id ?? "neu"}`} className="label">
              PLZ *
            </label>
            <input
              id={`mieter-plz-${mieter?.id ?? "neu"}`}
              name="plz"
              className="input"
              defaultValue={mieter?.plz ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.plz} />
          </div>
          <div>
            <label htmlFor={`mieter-ort-${mieter?.id ?? "neu"}`} className="label">
              Ort *
            </label>
            <input
              id={`mieter-ort-${mieter?.id ?? "neu"}`}
              name="ort"
              className="input"
              defaultValue={mieter?.ort ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.ort} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`mieter-notiz-${mieter?.id ?? "neu"}`} className="label">
            Notiz
          </label>
          <input
            id={`mieter-notiz-${mieter?.id ?? "neu"}`}
            name="notiz"
            className="input"
            defaultValue={mieter?.notiz ?? ""}
            placeholder="z.B. Ponyhof-Chor, mietet jeden ersten Montag"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          {bearbeiten ? "Speichern" : "Mieter anlegen"}
        </SubmitButton>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

/** Archivieren/Reaktivieren + Löschen (Löschschutz serverseitig). */
export function MieterAktionen({ mieter }: { mieter: MieterDaten & { active: boolean } }) {
  const [archivState, archivAction] = useActionState(archiviereMieterAction, idleFormState);
  const [loeschState, loeschAction] = useActionState(loescheMieterAction, idleFormState);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={archivAction}>
        <input type="hidden" name="id" value={mieter.id} />
        <input type="hidden" name="archiviert" value={mieter.active ? "true" : "false"} />
        <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">
          {mieter.active ? "Archivieren" : "Reaktivieren"}
        </SubmitButton>
      </form>
      <form
        action={loeschAction}
        onSubmit={(e) => {
          if (!confirm(`Mieter «${mieter.name}» endgültig löschen? (Nur möglich ohne Vermietungen/Rechnungen.)`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={mieter.id} />
        <SubmitButton className="btn-danger px-3 py-1.5 text-xs" pendingText="…">
          Löschen
        </SubmitButton>
      </form>
      <FormAlert state={archivState} />
      <FormAlert state={loeschState} />
    </div>
  );
}

// ——— Vermietung (Einzeltermin) ————————————————————————————————————————

export interface VermietungFormularDaten {
  id: string;
  mieterId: string;
  raumId: string;
  datum: string;
  startZeit: string;
  endZeit: string;
  preisChf: string;
  status: string;
  notiz: string | null;
}

/** Vermietung erfassen/bearbeiten: Raum, Datum, Zeitfenster, Mieter, Preis. */
export function VermietungFormular({
  mieter,
  raeume,
  vermietung,
}: {
  mieter: readonly OptionItem[];
  raeume: readonly OptionItem[];
  vermietung?: VermietungFormularDaten;
}) {
  const [state, formAction] = useActionState(saveVermietungAction, idleFormState);
  const bearbeiten = Boolean(vermietung);
  const idSuffix = vermietung?.id ?? "neu";
  return (
    <form action={formAction} className="space-y-4">
      {vermietung && <input type="hidden" name="id" value={vermietung.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`v-mieter-${idSuffix}`} className="label">
            Mieter *
          </label>
          <select id={`v-mieter-${idSuffix}`} name="mieterId" className="input" defaultValue={vermietung?.mieterId ?? ""} required>
            <option value="" disabled>
              Mieter wählen …
            </option>
            {mieter.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.mieterId} />
        </div>
        <div>
          <label htmlFor={`v-raum-${idSuffix}`} className="label">
            Raum *
          </label>
          <select id={`v-raum-${idSuffix}`} name="raumId" className="input" defaultValue={vermietung?.raumId ?? ""} required>
            <option value="" disabled>
              Raum wählen …
            </option>
            {raeume.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.raumId} />
        </div>
        <div>
          <label htmlFor={`v-datum-${idSuffix}`} className="label">
            Datum *
          </label>
          <input
            id={`v-datum-${idSuffix}`}
            name="datum"
            type="date"
            className="input"
            defaultValue={vermietung?.datum ?? ""}
            required
          />
          <FieldError message={state.fieldErrors?.datum} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`v-start-${idSuffix}`} className="label">
              Von *
            </label>
            <input
              id={`v-start-${idSuffix}`}
              name="startZeit"
              type="time"
              step={300}
              className="input"
              defaultValue={vermietung?.startZeit ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.startZeit} />
          </div>
          <div>
            <label htmlFor={`v-ende-${idSuffix}`} className="label">
              Bis *
            </label>
            <input
              id={`v-ende-${idSuffix}`}
              name="endZeit"
              type="time"
              step={300}
              className="input"
              defaultValue={vermietung?.endZeit ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.endZeit} />
          </div>
        </div>
        <div>
          <label htmlFor={`v-preis-${idSuffix}`} className="label">
            Preis CHF * (frei vergeben)
          </label>
          <input
            id={`v-preis-${idSuffix}`}
            name="preisChf"
            type="number"
            step="0.05"
            min="0.05"
            max="999999"
            className="input"
            defaultValue={vermietung?.preisChf ?? ""}
            placeholder="120.00"
            required
          />
          <FieldError message={state.fieldErrors?.preisChf} />
        </div>
        {bearbeiten && (
          <div>
            <label htmlFor={`v-status-${idSuffix}`} className="label">
              Status
            </label>
            <select id={`v-status-${idSuffix}`} name="status" className="input" defaultValue={vermietung?.status ?? "GEPLANT"}>
              <option value="GEPLANT">geplant</option>
              <option value="FINDET_STATT">findet statt</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Absagen laufen separat (mit Grund).</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor={`v-notiz-${idSuffix}`} className="label">
            Notiz
          </label>
          <input id={`v-notiz-${idSuffix}`} name="notiz" className="input" defaultValue={vermietung?.notiz ?? ""} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          {bearbeiten ? "Speichern" : "Vermietung erfassen"}
        </SubmitButton>
        <FormAlert state={state} />
      </div>
      <p className="text-xs text-slate-500">
        Doppelbelegungen blockieren nicht — das Büro erhält einen Hinweis und der Raumplaner markiert den Konflikt.
      </p>
    </form>
  );
}

// ——— Serie ——————————————————————————————————————————————————————————

/** Serie anlegen: materialisiert sofort alle Termine im Zeitraum. */
export function SerieFormular({
  mieter,
  raeume,
}: {
  mieter: readonly OptionItem[];
  raeume: readonly OptionItem[];
}) {
  const [state, formAction] = useActionState(saveSerieAction, idleFormState);
  const wochentage = [
    ["1", "Montag"],
    ["2", "Dienstag"],
    ["3", "Mittwoch"],
    ["4", "Donnerstag"],
    ["5", "Freitag"],
    ["6", "Samstag"],
  ] as const;
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="serie-mieter" className="label">
            Mieter *
          </label>
          <select id="serie-mieter" name="mieterId" className="input" required defaultValue="">
            <option value="" disabled>
              Mieter wählen …
            </option>
            {mieter.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.mieterId} />
        </div>
        <div>
          <label htmlFor="serie-raum" className="label">
            Raum *
          </label>
          <select id="serie-raum" name="raumId" className="input" required defaultValue="">
            <option value="" disabled>
              Raum wählen …
            </option>
            {raeume.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.raumId} />
        </div>
        <div>
          <label htmlFor="serie-wochentag" className="label">
            Wochentag *
          </label>
          <select id="serie-wochentag" name="wochentag" className="input" required defaultValue="2">
            {wochentage.map(([wert, label]) => (
              <option key={wert} value={wert}>
                jeden {label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.wochentag} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="serie-start" className="label">
              Von *
            </label>
            <input id="serie-start" name="startZeit" type="time" step={300} className="input" required />
            <FieldError message={state.fieldErrors?.startZeit} />
          </div>
          <div>
            <label htmlFor="serie-ende" className="label">
              Bis *
            </label>
            <input id="serie-ende" name="endZeit" type="time" step={300} className="input" required />
            <FieldError message={state.fieldErrors?.endZeit} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="serie-von" className="label">
              Erster Termin *
            </label>
            <input id="serie-von" name="von" type="date" className="input" required />
            <FieldError message={state.fieldErrors?.von} />
          </div>
          <div>
            <label htmlFor="serie-bis" className="label">
              Letzter Termin *
            </label>
            <input id="serie-bis" name="bis" type="date" className="input" required />
            <FieldError message={state.fieldErrors?.bis} />
          </div>
        </div>
        <div>
          <label htmlFor="serie-preis" className="label">
            Preis pro Termin CHF *
          </label>
          <input
            id="serie-preis"
            name="preisChf"
            type="number"
            step="0.05"
            min="0.05"
            max="999999"
            className="input"
            placeholder="80.00"
            required
          />
          <FieldError message={state.fieldErrors?.preisChf} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="serie-notiz" className="label">
            Notiz
          </label>
          <input id="serie-notiz" name="notiz" className="input" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Erzeugt Termine…">
          Serie anlegen
        </SubmitButton>
        <FormAlert state={state} />
      </div>
      <p className="text-xs text-slate-500">
        Beim Anlegen werden sofort alle konkreten Termine erzeugt — jeder einzeln absagbar/löschbar
        (Planer + Vermietungsliste). Doppelbelegungen blockieren nicht.
      </p>
    </form>
  );
}

// ——— Aktionen einer Vermietung (Detailseite) ———————————————————————————

export function VermietungAktionen({
  vermietung,
}: {
  vermietung: {
    id: string;
    status: string;
    mieterName: string;
    hatRechnung: boolean;
  };
}) {
  const [statusState, statusAction] = useActionState(aendereVermietungStatusAction, idleFormState);
  const [sageState, sageAction] = useActionState(sageVermietungAbAction, idleFormState);
  const [loeschState, loeschAction] = useActionState(loescheVermietungAction, idleFormState);
  const [rechnungState, rechnungAction] = useActionState(erstelleVermietungRechnungAction, idleFormState);
  const abgesagt = vermietung.status === "ABGESAGT";

  return (
    <div className="space-y-4">
      {/* Meldungen persistent: revalidatePath (z.B. nach der Rechnungs-Erstellung)
          kann die Sektionen darunter neu zeichnen — die Alerts müssen überleben. */}
      <FormAlert state={statusState} />
      <FormAlert state={rechnungState} />
      <FormAlert state={sageState} />
      <FormAlert state={loeschState} />

      {!abgesagt && (
        <div className="flex flex-wrap items-center gap-2">
          {vermietung.status === "GEPLANT" ? (
            <form action={statusAction}>
              <input type="hidden" name="vermietungId" value={vermietung.id} />
              <input type="hidden" name="status" value="FINDET_STATT" />
              <SubmitButton className="btn-primary" pendingText="…">
                Findet statt (bestätigen)
              </SubmitButton>
            </form>
          ) : (
            <form action={statusAction}>
              <input type="hidden" name="vermietungId" value={vermietung.id} />
              <input type="hidden" name="status" value="GEPLANT" />
              <SubmitButton className="btn-secondary" pendingText="…">
                Zurück auf «geplant»
              </SubmitButton>
            </form>
          )}
        </div>
      )}

      {!abgesagt && !vermietung.hatRechnung && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={rechnungAction}>
            <input type="hidden" name="vermietungId" value={vermietung.id} />
            <SubmitButton className="btn-secondary" pendingText="Erstellt Entwurf…">
              Rechnungs-Entwurf erstellen
            </SubmitButton>
          </form>
        </div>
      )}

      {!abgesagt && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Vermietung absagen
          </h3>
          <form action={sageAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="vermietungId" value={vermietung.id} />
            <div>
              <label htmlFor="v-absage-grund" className="label">
                Grund (Pflicht)
              </label>
              <input id="v-absage-grund" name="grund" className="input" placeholder="z.B. Mieter sagt ab" required />
              <FieldError message={sageState.fieldErrors?.grund} />
            </div>
            <div className="pb-0.5">
              <SubmitButton className="btn-danger" pendingText="…">
                Absagen
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {!vermietung.hatRechnung && (
        <div className="flex flex-wrap items-center gap-2">
          <form
            action={loeschAction}
            onSubmit={(e) => {
              if (!confirm(`Vermietung (${vermietung.mieterName}) endgültig löschen?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="vermietungId" value={vermietung.id} />
            <SubmitButton className="btn-danger" pendingText="…">
              Vermietung löschen
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
