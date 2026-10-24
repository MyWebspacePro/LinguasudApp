"use client";

import { useActionState } from "react";
import { addQualifikationAction, removeQualifikationAction } from "@/lib/personen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import type { PersonOption } from "./PersonFamilie";

/** Lehrperson-Qualifikationen: unterrichtete Sprachen × Niveaus (Modul 3). */
export function PersonQualifikationen({
  personId,
  istLehrperson,
  qualifikationen,
  sprachen,
  niveaus,
  canManage,
}: {
  personId: string;
  istLehrperson: boolean;
  qualifikationen: { id: string; label: string }[];
  sprachen: PersonOption[];
  niveaus: PersonOption[];
  canManage: boolean;
}) {
  const [addState, addFormAction] = useActionState(addQualifikationAction, idleFormState);
  const [removeState, removeFormAction] = useActionState(removeQualifikationAction, idleFormState);

  if (!istLehrperson) {
    return (
      <div className="alert-info">
        Diese Person ist nicht als Lehrperson geführt. Qualifikationen (unterrichtete Sprachen ×
        Niveau) werden erfasst, sobald «Als Lehrperson führen» aktiviert ist.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormAlert state={removeState} />

      <ul className="divide-y divide-line">
        {qualifikationen.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="text-slate-800">{q.label}</span>
            {canManage && (
              <form
                action={removeFormAction}
                onSubmit={(e) => {
                  if (!confirm("Diese Qualifikation entfernen?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="qualifikationId" value={q.id} />
                <SubmitButton className="btn-secondary px-2 py-0.5 text-[11px] text-slate-500" pendingText="…">
                  Entfernen
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
        {qualifikationen.length === 0 && (
          <li className="py-2 text-sm text-slate-600">Noch keine Qualifikationen erfasst.</li>
        )}
      </ul>

      {canManage && (
        <form action={addFormAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="personId" value={personId} />
          <div className="min-w-40 flex-1">
            <label htmlFor={`qual-sprache-${personId}`} className="label">
              Sprache
            </label>
            <select id={`qual-sprache-${personId}`} name="spracheId" required className="input" defaultValue="">
              <option value="" disabled>
                Sprache …
              </option>
              {sprachen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40 flex-1">
            <label htmlFor={`qual-niveau-${personId}`} className="label">
              Niveau
            </label>
            <select id={`qual-niveau-${personId}`} name="niveauId" required className="input" defaultValue="">
              <option value="" disabled>
                Niveau …
              </option>
              {niveaus.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className="btn-secondary" pendingText="…">
            Hinzufügen
          </SubmitButton>
        </form>
      )}
      {addState.error && <FormAlert state={addState} />}
      {addState.success && <FormAlert state={addState} />}
    </div>
  );
}
