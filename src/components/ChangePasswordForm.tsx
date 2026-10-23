"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { changeOwnPasswordAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { PasswordField } from "./PasswordField";
import { SubmitButton } from "./SubmitButton";

/** Eigenes Passwort ändern — freiwillig oder erzwungen (mustChangePassword). */
export function ChangePasswordForm({
  continueHref,
}: {
  /** Ziel nach erfolgreichem Wechsel (z.B. Startseite der Rolle). */
  continueHref: string;
}) {
  const [state, formAction] = useActionState(changeOwnPasswordAction, idleFormState);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <PasswordField
        name="currentPassword"
        label="Aktuelles Passwort"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        error={state.fieldErrors?.currentPassword}
      />
      <PasswordField
        name="password"
        label="Neues Passwort"
        showPolicy
        value={password}
        onChange={setPassword}
        error={state.fieldErrors?.password}
      />
      <PasswordField
        name="confirm"
        label="Neues Passwort wiederholen"
        value={confirm}
        onChange={setConfirm}
      />

      <div className="flex items-center gap-3">
        <SubmitButton>Passwort ändern</SubmitButton>
        {state.success && (
          <Link href={continueHref} className="btn-secondary">
            Weiter zur Anwendung
          </Link>
        )}
      </div>
    </form>
  );
}
