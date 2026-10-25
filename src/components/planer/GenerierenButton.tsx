"use client";

import { useActionState } from "react";
import { generiereLektionenAction } from "@/lib/planer/actions";
import { idleFormState } from "@/lib/forms";
import { SubmitButton } from "@/components/SubmitButton";

/** Manueller Anstoss der rollierenden Generierung (nur Büro). */
export function GenerierenButton() {
  const [state, formAction] = useActionState(generiereLektionenAction, idleFormState);
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <SubmitButton className="btn-secondary" pendingText="Generiere …">
          Lektionen generieren (2 Wochen)
        </SubmitButton>
      </form>
      {state.error || state.success ? (
        <p className={`text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>
          {state.error ?? state.success}
        </p>
      ) : null}
    </div>
  );
}
