"use client";

import { useActionState } from "react";
import { revokeUserSessionsAction, setUserActiveAction } from "@/lib/users/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

/** Konto aktivieren/deaktivieren. */
export function UserActiveToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState(setUserActiveAction, idleFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <FormAlert state={state} />
      <p className="text-sm text-slate-600">
        Status:{" "}
        {isActive ? (
          <span className="font-medium text-emerald-700">aktiv</span>
        ) : (
          <span className="font-medium text-slate-500">deaktiviert</span>
        )}
      </p>
      <SubmitButton className={isActive ? "btn-danger" : "btn-secondary"}>
        {isActive ? "Konto deaktivieren" : "Konto aktivieren"}
      </SubmitButton>
    </form>
  );
}

/** Alle laufenden Sitzungen einer Person beenden. */
export function UserSessionsRevoke({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(revokeUserSessionsAction, idleFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <FormAlert state={state} />
      <SubmitButton className="btn-secondary">Alle Sitzungen beenden</SubmitButton>
    </form>
  );
}
