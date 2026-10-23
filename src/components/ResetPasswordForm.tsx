"use client";

import { useActionState, useState } from "react";
import { resetPasswordWithTokenAction } from "@/lib/auth/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "./FormAlert";
import { PasswordField } from "./PasswordField";
import { SubmitButton } from "./SubmitButton";

/** Neues Passwort per Einmal-Link setzen (Reset oder Ersteinrichtung). */
export function ResetPasswordForm({ token, isNewAccount }: { token: string; isNewAccount: boolean }) {
  const [state, formAction] = useActionState(resetPasswordWithTokenAction, idleFormState);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormAlert state={state} />

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
        label="Passwort wiederholen"
        value={confirm}
        onChange={setConfirm}
      />

      <SubmitButton className="btn-primary w-full">
        {isNewAccount ? "Passwort festlegen" : "Passwort neu setzen"}
      </SubmitButton>
    </form>
  );
}
