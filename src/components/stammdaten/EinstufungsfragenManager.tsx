"use client";

// Fragenkatalog-Verwaltung (Modul 13, Stammdaten — nur Admin): Fragen je
// Sprache × Niveau mit 4 Antwortoptionen; anlegen/bearbeiten, aktivieren,
// löschen. Die öffentliche Seite /einstufungstest zeigt nur aktive Fragen.

import { useActionState, useEffect, useState } from "react";

import {
  archiviereEinstufungsfrageAction,
  loescheEinstufungsfrageAction,
  saveEinstufungsfrageAction,
} from "@/lib/anfragen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

interface FrageZeile {
  id: string;
  spracheId: string;
  niveauId: string;
  text: string;
  antworten: string[];
  richtig: number;
  sortOrder: number;
  active: boolean;
}

interface Option {
  id: string;
  label: string;
}
/** Fragenkatalog: Liste (gruppiert nach Sprache → Niveau) + Formular. */
export function EinstufungsfragenManager({
  fragen,
  sprachen,
  niveaus,
  canManage,
}: {
  fragen: FrageZeile[];
  sprachen: Option[];
  niveaus: Option[];
  canManage: boolean;
}) {
  const [bearbeitetId, setBearbeitetId] = useState<string | null>(null);

  const spracheById = new Map(sprachen.map((s) => [s.id, s.label]));
  const niveauById = new Map(niveaus.map((n) => [n.id, n.label]));

  // Gruppieren: Sprache → Niveau (Reihenfolge nach Stammdaten-Sortierung).
  const spracheReihenfolge = new Map(sprachen.map((s, i) => [s.id, i]));
  const niveauReihenfolge = new Map(niveaus.map((n, i) => [n.id, i]));
  const gruppen = new Map<string, FrageZeile[]>();
  for (const f of fragen) {
    const liste = gruppen.get(f.spracheId) ?? [];
    liste.push(f);
    gruppen.set(f.spracheId, liste);
  }
  const gruppiert = [...gruppen.entries()]
    .sort(([a], [b]) => (spracheReihenfolge.get(a) ?? 99) - (spracheReihenfolge.get(b) ?? 99))
    .map(([spracheId, liste]) => ({
      spracheId,
      fragen: liste.sort(
        (a, b) =>
          (niveauReihenfolge.get(a.niveauId) ?? 99) - (niveauReihenfolge.get(b.niveauId) ?? 99) ||
          a.sortOrder - b.sortOrder,
      ),
    }));

  return (
    <div className="space-y-5">
      {canManage && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            {bearbeitetId ? "Frage bearbeiten" : "Neue Frage"}
          </h2>
          <div className="mt-3">
            <FrageFormular
              sprachen={sprachen}
              niveaus={niveaus}
              frage={bearbeitetId ? (fragen.find((f) => f.id === bearbeitetId) ?? undefined) : undefined}
              onDone={() => setBearbeitetId(null)}
            />
          </div>
        </section>
      )}

      {fragen.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          Noch keine Fragen erfasst — der öffentliche Test ist leer, bis die erste Frage angelegt wird.
        </div>
      ) : (
        gruppiert.map(({ spracheId, fragen: liste }) => (
          <section key={spracheId} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {spracheById.get(spracheId) ?? "?"}{" "}
              <span className="ml-1 text-xs font-normal text-slate-500">({liste.length} Fragen)</span>
            </h2>
            <div className="card divide-y divide-line p-0">
              {liste.map((f) => (
                <div key={f.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        <span className="mr-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                          {niveauById.get(f.niveauId) ?? "?"}
                        </span>
                        {f.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {f.antworten.map((a, i) => (
                          <span key={i} className={i + 1 === f.richtig ? "mr-2 font-semibold text-emerald-700" : "mr-2"}>
                            {i + 1}. {a}
                          </span>
                        ))}
                        <span className="ml-1 text-slate-400">· Reihenfolge {f.sortOrder}</span>
                        {!f.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">inaktiv</span>}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBearbeitetId(f.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="text-xs font-medium text-brand-700 hover:text-brand-800"
                        >
                          Bearbeiten
                        </button>
                        <FrageAktionen frage={f} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** Formular für eine Frage (neu oder bearbeiten) — 4 feste Antwortoptionen. */
function FrageFormular({
  sprachen,
  niveaus,
  frage,
  onDone,
}: {
  sprachen: Option[];
  niveaus: Option[];
  frage?: FrageZeile;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveEinstufungsfrageAction, idleFormState);
  const bearbeiten = Boolean(frage);

  // Nach erfolgreichem Speichern zurück auf «Neue Frage» wechseln.
  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-3">
    {frage && <input type="hidden" name="id" value={frage.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ef-sprache" className="label">
            Sprache *
          </label>
          <select id="ef-sprache" name="spracheId" className="input" defaultValue={frage?.spracheId ?? ""} required>
            <option value="" disabled>
              Sprache wählen …
            </option>
            {sprachen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.spracheId} />
        </div>
        <div>
          <label htmlFor="ef-niveau" className="label">
            Niveau *
          </label>
          <select id="ef-niveau" name="niveauId" className="input" defaultValue={frage?.niveauId ?? ""} required>
            <option value="" disabled>
              Niveau wählen …
            </option>
            {niveaus.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.niveauId} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="ef-sortorder" className="label">
              Reihenfolge
            </label>
            <input id="ef-sortorder" name="sortOrder" type="number" min={0} className="input" defaultValue={frage?.sortOrder ?? 0} />
            <FieldError message={state.fieldErrors?.sortOrder} />
          </div>
          <div>
            <label htmlFor="ef-active" className="label">
              Status
            </label>
            <select id="ef-active" name="active" className="input" defaultValue={frage?.active === false ? "false" : "true"}>
              <option value="true">aktiv</option>
              <option value="false">inaktiv</option>
            </select>
          </div>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="ef-text" className="label">
            Fragetext *
          </label>
          <input id="ef-text" name="text" className="input" defaultValue={frage?.text ?? ""} required />
          <FieldError message={state.fieldErrors?.text} />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <label htmlFor={`ef-antwort${i}`} className="label">
              Antwort {i} *
            </label>
            <input
              id={`ef-antwort${i}`}
              name={`antwort${i}`}
              className="input"
              defaultValue={frage?.antworten[i - 1] ?? ""}
              required
            />
            <FieldError message={state.fieldErrors?.[`antwort${i}`]} />
          </div>
        ))}
        <div className="sm:col-span-3">
          <label htmlFor="ef-richtig" className="label">
            Richtige Antwort *
          </label>
          <select id="ef-richtig" name="richtig" className="input" defaultValue={frage?.richtig ?? ""} required>
            <option value="" disabled>
              Richtige Antwort wählen …
            </option>
            {[1, 2, 3, 4].map((i) => (
              <option key={i} value={i}>
                Antwort {i}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.richtig} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary" pendingText="Speichert…">
          {bearbeiten ? "Speichern" : "Frage anlegen"}
        </SubmitButton>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

/** Aktivieren/deaktivieren + löschen (mit Bestätigung). */
function FrageAktionen({ frage }: { frage: FrageZeile }) {
  const [archivState, archivAction] = useActionState(archiviereEinstufungsfrageAction, idleFormState);
  const [loeschState, loeschAction] = useActionState(loescheEinstufungsfrageAction, idleFormState);

  return (
    <span className="flex items-center gap-1.5">
      <form action={archivAction}>
        <input type="hidden" name="id" value={frage.id} />
        <input type="hidden" name="deaktiviert" value={frage.active ? "true" : "false"} />
        <SubmitButton className="text-xs font-medium text-slate-500 hover:text-brand-700" pendingText="…">
          {frage.active ? "Deaktivieren" : "Aktivieren"}
        </SubmitButton>
      </form>
      <form
        action={loeschAction}
        onSubmit={(e) => {
          if (!confirm(`Frage «${frage.text}» endgültig löschen?`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={frage.id} />
        <SubmitButton className="text-xs font-medium text-red-600 hover:text-red-700" pendingText="…">
          Löschen
        </SubmitButton>
      </form>
      <FormAlert state={archivState} />
      <FormAlert state={loeschState} />
    </span>
  );
}
