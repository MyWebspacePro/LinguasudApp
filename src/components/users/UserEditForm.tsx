"use client";

import { useActionState } from "react";
import { roleList, type Role } from "@/lib/domain";
import { updateUserAction } from "@/lib/users/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { RoleSelector } from "./RoleSelector";

/** Stammdaten + Rollen eines bestehenden Kontos bearbeiten. */
export function UserEditForm({
  user,
  assignableRoles,
}: {
  user: { id: string; firstName: string; lastName: string; email: string; roles: Role[] };
  assignableRoles: Role[];
}) {
  const [state, formAction] = useActionState(updateUserAction, idleFormState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="userId" value={user.id} />
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`first-${user.id}`} className="label">
            Vorname
          </label>
          <input
            id={`first-${user.id}`}
            name="firstName"
            defaultValue={user.firstName}
            required
            className="input"
          />
          {state.fieldErrors?.firstName && (
            <p className="field-error">{state.fieldErrors.firstName}</p>
          )}
        </div>
        <div>
          <label htmlFor={`last-${user.id}`} className="label">
            Nachname
          </label>
          <input
            id={`last-${user.id}`}
            name="lastName"
            defaultValue={user.lastName}
            required
            className="input"
          />
          {state.fieldErrors?.lastName && <p className="field-error">{state.fieldErrors.lastName}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`email-${user.id}`} className="label">
          E-Mail (Login)
        </label>
        <input
          id={`email-${user.id}`}
          name="email"
          type="email"
          defaultValue={user.email}
          required
          className="input"
        />
        {state.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email}</p>}
      </div>

      <RoleSelector
        assignableRoles={assignableRoles}
        initialRoles={roleList(user.roles)}
        error={state.fieldErrors?.roles}
      />

      <SubmitButton>Änderungen speichern</SubmitButton>
    </form>
  );
}
