"use client";

import { useActionState } from "react";
import { deletePersonAction } from "@/lib/personen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Person löschen — nur wenn unbenutzt (kein Konto, keine Familien-Verknüpfungen,
 * keine Qualifikationen). CRM-Notizen werden mitgelöscht und im Audit-Log
 * festgehalten; sonst ist der Weg «inaktiv».
 */
export function PersonDeletePanel({
  personId,
  personLabel,
  deletable,
  blockHint,
}: {
  personId: string;
  personLabel: string;
  deletable: boolean;
  blockHint: string | null;
}) {
  const [state, formAction] = useActionState(deletePersonAction, idleFormState);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        {deletable
          ? "Die Person ist nicht verknüpft und kann endgültig gelöscht werden (CRM-Notizen inklusive)."
          : (blockHint ??
            "Diese Person wird verwendet und kann nicht gelöscht werden. Status «inaktiv» entfernt sie aus der aktiven Arbeit.")}
      </p>
      <FormAlert state={state} />
      {deletable && (
        <form
          action={formAction}
          onSubmit={(e) => {
            if (!confirm(`«${personLabel}» endgültig löschen? CRM-Notizen gehen verloren.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={personId} />
          <SubmitButton className="btn-danger" pendingText="Wird gelöscht …">
            Person endgültig löschen
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
