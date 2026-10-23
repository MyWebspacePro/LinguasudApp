"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { SubmitButton } from "./SubmitButton";

/** Formular für «Passwort vergessen» — Antwort bewusst generisch. */
export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, idleFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <div>
        <label htmlFor="reset-email" className="label">
          E-Mail-Adresse
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="input"
          placeholder="name@beispiel.ch"
        />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Wird gesendet …">
        Link anfordern
      </SubmitButton>
    </form>
  );
}
