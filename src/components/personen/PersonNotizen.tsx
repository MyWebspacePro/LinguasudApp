"use client";

import { useActionState } from "react";
import { addNotizAction, deleteNotizAction } from "@/lib/personen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface NotizEntry {
  id: string;
  text: string;
  authorName: string;
  /** Serverseitig formatiert (de-CH). */
  createdAt: string;
}

/** CRM-Notizen zur Person — jede Notiz mit Autor und Datum (Pflichtenheft). */
export function PersonNotizen({
  personId,
  notizen,
  canManage,
}: {
  personId: string;
  notizen: NotizEntry[];
  canManage: boolean;
}) {
  const [addState, addFormAction] = useActionState(addNotizAction, idleFormState);
  const [deleteState, deleteFormAction] = useActionState(deleteNotizAction, idleFormState);

  return (
    <div className="space-y-4">
      {canManage && (
        <form action={addFormAction} className="space-y-2" key={addState.success ?? "idle"}>
          <input type="hidden" name="personId" value={personId} />
          <label htmlFor={`notiz-${personId}`} className="label">
            Neue Notiz
          </label>
          <textarea
            id={`notiz-${personId}`}
            name="text"
            rows={3}
            required
            placeholder="Gespräch, Vereinbarung, Hintergrund …"
            className="input"
          />
          <FormAlert state={addState} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Autor und Datum werden automatisch erfasst.
            </p>
            <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Notiz erfassen</SubmitButton>
          </div>
        </form>
      )}

      {deleteState.error && <FormAlert state={deleteState} />}

      <ul className="divide-y divide-line">
        {notizen.map((notiz) => (
          <li key={notiz.id} className="py-3">
            <p className="text-sm whitespace-pre-wrap text-slate-800">{notiz.text}</p>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {notiz.authorName} · {notiz.createdAt}
              </span>
              {canManage && (
                <form
                  action={deleteFormAction}
                  onSubmit={(e) => {
                    if (!confirm("Diese Notiz endgültig löschen?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="notizId" value={notiz.id} />
                  <SubmitButton className="btn-secondary px-2 py-0.5 text-[11px] text-slate-500" pendingText="…">
                    Löschen
                  </SubmitButton>
                </form>
              )}
            </div>
          </li>
        ))}
        {notizen.length === 0 && (
          <li className="py-4 text-sm text-slate-600">Noch keine Notizen.</li>
        )}
      </ul>
    </div>
  );
}
