"use client";

// CMS-Formulare (Modul 15): Seiten mit DE/EN-Übersetzung und Pop-up.
// Muster wie überall: useActionState + FormState, Feldfehler je Feld,
// FormAlert ausserhalb bedingter Blöcke.

import { useActionState } from "react";
import Link from "next/link";

import type { FormState } from "@/lib/forms";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import {
  loeschePopupAction,
  loescheSeiteAction,
  speicherePopupAction,
  speichereSeiteAction,
} from "@/lib/website/actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export interface SeiteDaten {
  id: string | null;
  slug: string;
  typ: string;
  typFixiert: boolean;
  inNavigation: boolean;
  navSortOrder: number;
  imFuss: boolean;
  active: boolean;
  de: { titel: string; untertitel: string; inhalt: string; seoTitel: string; seoBeschreibung: string };
  en: { titel: string; untertitel: string; inhalt: string; seoTitel: string; seoBeschreibung: string } | null;
}

export function SeiteForm({ seite }: { seite: SeiteDaten }) {
  const [state, formAction] = useActionState(speichereSeiteAction, idleFormState);
  const en = seite.en ?? { titel: "", untertitel: "", inhalt: "", seoTitel: "", seoBeschreibung: "" };

  return (
    <form action={formAction} className="space-y-5">
      {seite.id && <input type="hidden" name="id" value={seite.id} />}

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Einstellungen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ws-slug" className="label">
              URL-Pfad (Slug) *
            </label>
            <input
              id="ws-slug"
              name="slug"
              className="input"
              required
              disabled={seite.typFixiert}
              defaultValue={seite.slug}
              placeholder="z.B. ueber-uns oder sprachen/weitere"
            />
            <FieldError message={state.fieldErrors?.slug} />
            <p className="mt-1 text-xs text-slate-500">
              {seite.typFixiert
                ? "Startseiten-Pfad ist fix (nur unter «/» erreichbar)."
                : "Öffentliche URL: /<pfad> (EN: /en/<pfad>)."}
            </p>
          </div>
          <div>
            <label htmlFor="ws-typ" className="label">
              Seitentyp
            </label>
            <select id="ws-typ" name="typ" className="input" disabled={seite.typFixiert} defaultValue={seite.typ}>
              <option value="SEITE">Normale Seite</option>
              <option value="START">Startseite</option>
              <option value="SPRACHE">Sprachseite (mit Live-Kursen)</option>
            </select>
            <FieldError message={state.fieldErrors?.typ} />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="inNavigation" defaultChecked={seite.inNavigation} className="h-4 w-4" />
            In der Hauptnavigation
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="imFuss" defaultChecked={seite.imFuss} className="h-4 w-4" />
            Link im Fussbereich (z.B. AGB/Datenschutz)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked={seite.active} className="h-4 w-4" />
            Aktiv (öffentlich sichtbar)
          </label>
          <div>
            <label htmlFor="ws-nav-sort" className="label">
              Nav-Reihenfolge
            </label>
            <input
              id="ws-nav-sort"
              name="navSortOrder"
              type="number"
              min={0}
              className="input w-24"
              defaultValue={seite.navSortOrder}
            />
            <FieldError message={state.fieldErrors?.navSortOrder} />
          </div>
        </div>
      </div>

      {(["de", "en"] as const).map((loc) => {
        const daten = loc === "de" ? seite.de : en;
        const label = loc === "de" ? "Deutsch (Pflicht)" : "Englisch (optional — leer = Deutsch anzeigen)";
        return (
          <div key={loc} className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`ws-titel-${loc}`} className="label">
                  Titel {loc === "de" ? "*" : ""}
                </label>
                <input id={`ws-titel-${loc}`} name={`titel_${loc}`} className="input" defaultValue={daten.titel} />
                <FieldError message={state.fieldErrors?.[`titel_${loc}`]} />
              </div>
              <div>
                <label htmlFor={`ws-untertitel-${loc}`} className="label">
                  Untertitel
                </label>
                <input
                  id={`ws-untertitel-${loc}`}
                  name={`untertitel_${loc}`}
                  className="input"
                  defaultValue={daten.untertitel}
                />
              </div>
            </div>
            <div>
              <label htmlFor={`ws-inhalt-${loc}`} className="label">
                Inhalt {loc === "de" ? "*" : ""}
              </label>
              <textarea
                id={`ws-inhalt-${loc}`}
                name={`inhalt_${loc}`}
                rows={10}
                className="input font-mono"
                defaultValue={daten.inhalt}
                placeholder={"Absätze durch Leerzeilen trennen.\n## Zwischentitel\n- Aufzählungspunkt"}
              />
              <FieldError message={state.fieldErrors?.[`inhalt_${loc}`]} />
              <p className="mt-1 text-xs text-slate-500">
                Klartext: Absätze durch Leerzeilen, «## » = Zwischentitel, «- » = Aufzählungspunkt.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`ws-seo-titel-${loc}`} className="label">
                  SEO-Titel (Browser/Suchresultate)
                </label>
                <input
                  id={`ws-seo-titel-${loc}`}
                  name={`seo_titel_${loc}`}
                  className="input"
                  defaultValue={daten.seoTitel}
                />
              </div>
              <div>
                <label htmlFor={`ws-seo-beschr-${loc}`} className="label">
                  SEO-Beschreibung
                </label>
                <input
                  id={`ws-seo-beschr-${loc}`}
                  name={`seo_beschreibung_${loc}`}
                  className="input"
                  defaultValue={daten.seoBeschreibung}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          Speichern
        </SubmitButton>
        <Link href="/website" className="btn-secondary">
          Abbrechen
        </Link>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

export function SeiteLoeschenButton({ seiteId, canDelete }: { seiteId: string; canDelete: boolean }) {
  if (!canDelete) return null;
  return (
    <form action={loescheSeiteAction}>
      <input type="hidden" name="id" value={seiteId} />
      <SubmitButton className="btn-danger" pendingText="Löscht…">
        Seite löschen
      </SubmitButton>
    </form>
  );
}

export interface PopupEingaben {
  id: string | null;
  titel: string;
  text: string;
  bildUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  aktiv: boolean;
  gueltigVon: string;
  gueltigBis: string;
}

export function PopupForm({ popup }: { popup: PopupEingaben }) {
  const [state, formAction] = useActionState(speicherePopupAction, idleFormState as FormState);

  return (
    <form action={formAction} className="space-y-4">
      {popup.id && <input type="hidden" name="id" value={popup.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wp-titel" className="label">
            Titel *
          </label>
          <input id="wp-titel" name="titel" className="input" required defaultValue={popup.titel} />
          <FieldError message={state.fieldErrors?.titel} />
        </div>
        <div>
          <label htmlFor="wp-bild" className="label">
            Bild-URL (optional, z.B. /logo-linguasud.png)
          </label>
          <input id="wp-bild" name="bildUrl" className="input" defaultValue={popup.bildUrl} />
        </div>
      </div>
      <div>
        <label htmlFor="wp-text" className="label">
          Text *
        </label>
        <textarea id="wp-text" name="text" rows={4} className="input" required defaultValue={popup.text} />
        <FieldError message={state.fieldErrors?.text} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wp-btn-label" className="label">
            Button-Text (optional)
          </label>
          <input id="wp-btn-label" name="buttonLabel" className="input" defaultValue={popup.buttonLabel} />
          <FieldError message={state.fieldErrors?.buttonLabel} />
        </div>
        <div>
          <label htmlFor="wp-btn-url" className="label">
            Button-URL
          </label>
          <input id="wp-btn-url" name="buttonUrl" className="input" defaultValue={popup.buttonUrl} placeholder="/einstufungstest" />
          <FieldError message={state.fieldErrors?.buttonUrl} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wp-von" className="label">
            Gültig von (optional)
          </label>
          <input id="wp-von" name="gueltigVon" type="datetime-local" className="input" defaultValue={popup.gueltigVon} />
          <FieldError message={state.fieldErrors?.gueltigVon} />
        </div>
        <div>
          <label htmlFor="wp-bis" className="label">
            Gültig bis (optional)
          </label>
          <input id="wp-bis" name="gueltigBis" type="datetime-local" className="input" defaultValue={popup.gueltigBis} />
          <FieldError message={state.fieldErrors?.gueltigBis} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="aktiv" defaultChecked={popup.aktiv} className="h-4 w-4" />
        Aktiv (Zeitfenster serverseitig geprüft)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          Speichern
        </SubmitButton>
        <Link href="/website" className="btn-secondary">
          Abbrechen
        </Link>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

export function PopupLoeschenButton({ popupId }: { popupId: string }) {
  return (
    <form action={loeschePopupAction}>
      <input type="hidden" name="id" value={popupId} />
      <SubmitButton className="btn-danger" pendingText="Löscht…">
        Löschen
      </SubmitButton>
    </form>
  );
}
