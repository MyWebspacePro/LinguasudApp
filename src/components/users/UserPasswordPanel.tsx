"use client";

import { useActionState, useState } from "react";
import { adminSetPasswordAction } from "@/lib/users/actions";
import { idleFormState } from "@/lib/forms";
import { generatePassword } from "@/lib/auth/password-policy";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

/** Passwort neu setzen: direkt (Admin/Büro) oder Link per E-Mail. */
export function UserPasswordPanel({
  userId,
  emailInviteAvailable,
}: {
  userId: string;
  emailInviteAvailable: boolean;
}) {
  const [state, formAction] = useActionState(adminSetPasswordAction, idleFormState);
  const defaultMode = emailInviteAvailable ? "email" : "manual";
  const [mode, setMode] = useState<"email" | "manual">(defaultMode);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <FormAlert state={state} />

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="email"
            checked={mode === "email"}
            disabled={!emailInviteAvailable}
            onChange={() => setMode("email")}
            className="accent-brand-700"
          />
          Link per E-Mail senden
          {!emailInviteAvailable && <span className="text-xs text-slate-400">(SMTP fehlt)</span>}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
            className="accent-brand-700"
          />
          Passwort direkt setzen
        </label>
      </div>

      {mode === "manual" && (
        <div className="space-y-2">
          <PasswordField
            name="password"
            label="Neues Passwort"
            showPolicy
            value={password}
            onChange={setPassword}
            error={state.fieldErrors?.password}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPassword(generatePassword())}
          >
            Passwort vorschlagen
          </button>
        </div>
      )}

      <SubmitButton className={mode === "manual" ? "btn-danger" : "btn-primary"}>
        {mode === "email" ? "E-Mail mit Link versenden" : "Passwort setzen"}
      </SubmitButton>
      <p className="text-xs text-slate-500">
        Nach dem Setzen werden alle laufenden Sitzungen dieser Person beendet und ein Passwortwechsel
        bei der nächsten Anmeldung erzwungen.
      </p>
    </form>
  );
}
