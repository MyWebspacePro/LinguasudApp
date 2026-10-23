"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { SubmitButton } from "./SubmitButton";

/** Login-Formular; liest ?next= (Rückkehr-Ziel) und ?reset=ok selbst aus der URL. */
export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const resetOk = params.get("reset") === "ok";
  const [state, formAction] = useActionState(loginAction, idleFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate={false}>
      <input type="hidden" name="next" value={next} />

      {resetOk && !state.error && (
        <div className="alert-success" role="status">
          Passwort gesetzt. Sie können sich jetzt anmelden.
        </div>
      )}
      <FormAlert state={state} />

      <div>
        <label htmlFor="login-email" className="label">
          E-Mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="input"
          placeholder="name@beispiel.ch"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="label">
          Passwort
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>

      <SubmitButton className="btn-primary w-full" pendingText="Anmelden …">
        Anmelden
      </SubmitButton>
    </form>
  );
}
