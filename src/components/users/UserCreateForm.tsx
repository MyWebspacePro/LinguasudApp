"use client";

import { useActionState, useState } from "react";
import type { Role } from "@prisma/client";
import { createUserAction } from "@/lib/users/actions";
import { idleFormState } from "@/lib/forms";
import { generatePassword } from "@/lib/auth/password-policy";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { RoleSelector } from "./RoleSelector";

/** Konto anlegen (keine Selbstregistrierung — nur Büro/Admin). */
export function UserCreateForm({
  assignableRoles,
  emailInviteAvailable,
}: {
  assignableRoles: Role[];
  emailInviteAvailable: boolean;
}) {
  const [state, formAction] = useActionState(createUserAction, idleFormState);
  const defaultMode = emailInviteAvailable ? "email" : "manual";
  const [mode, setMode] = useState<"email" | "manual">(defaultMode);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-firstName" className="label">
            Vorname
          </label>
          <input id="new-firstName" name="firstName" required className="input" />
          {state.fieldErrors?.firstName && (
            <p className="field-error">{state.fieldErrors.firstName}</p>
          )}
        </div>
        <div>
          <label htmlFor="new-lastName" className="label">
            Nachname
          </label>
          <input id="new-lastName" name="lastName" required className="input" />
          {state.fieldErrors?.lastName && <p className="field-error">{state.fieldErrors.lastName}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="new-email" className="label">
          E-Mail (späterer Login)
        </label>
        <input id="new-email" name="email" type="email" required className="input" />
        {state.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email}</p>}
      </div>

      <RoleSelector assignableRoles={assignableRoles} initialRoles={[]} error={state.fieldErrors?.roles} />

      <fieldset>
        <legend className="label">Passwort-Festlegung</legend>
        <div className="space-y-1.5">
          <ModeOption
            value="email"
            current={mode}
            onSelect={setMode}
            disabled={!emailInviteAvailable}
            title="Einladung per E-Mail"
            hint={
              emailInviteAvailable
                ? "Die Person erhält einen Link (60 Minuten gültig) und setzt ihr Passwort selbst."
                : "E-Mail-Versand ist noch nicht konfiguriert (IONOS-SMTP fehlt)."
            }
          />
          <ModeOption
            value="manual"
            current={mode}
            onSelect={setMode}
            title="Passwort direkt setzen"
            hint="Sie teilen das Passwort sicher ausserhalb der App mit; es muss beim ersten Login geändert werden."
          />
        </div>
      </fieldset>

      {mode === "manual" && (
        <div className="space-y-2">
          <PasswordField
            name="password"
            label="Initiales Passwort"
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

      <div className="flex items-center gap-3">
        <SubmitButton>Konto anlegen</SubmitButton>
      </div>
    </form>
  );
}

function ModeOption({
  value,
  current,
  onSelect,
  disabled,
  title,
  hint,
}: {
  value: "email" | "manual";
  current: "email" | "manual";
  onSelect: (mode: "email" | "manual") => void;
  disabled?: boolean;
  title: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <label
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition ${
        active && !disabled ? "border-brand-300 bg-brand-50" : "border-line bg-paper"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand-200"}`}
    >
      <input
        type="radio"
        name="mode"
        value={value}
        checked={active}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="mt-0.5 accent-brand-700"
      />
      <span>
        <span className="font-medium text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
