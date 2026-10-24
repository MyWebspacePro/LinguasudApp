"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/auth/permissions";

/**
 * Rollen-Auswahl als Checkbox-Gruppe. Rollen ausserhalb der eigenen
 * Vergabeberechtigung sind sichtbar, aber gesperrt (Rollenvergabe: nur Admin).
 */
export function RoleSelector({
  assignableRoles,
  initialRoles,
  error,
}: {
  assignableRoles: Role[];
  initialRoles: Role[];
  error?: string;
}) {
  const [selected, setSelected] = useState<Role[]>(initialRoles);

  const toggle = (role: Role) => {
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  return (
    <fieldset>
      <legend className="label">Rollen (Mehrfachauswahl)</legend>
      <div className="space-y-1.5">
        {ALL_ROLES.map((role) => {
          const assignable = assignableRoles.includes(role);
          const checked = selected.includes(role);
          return (
            <label
              key={role}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition ${
                checked ? "border-brand-300 bg-brand-50" : "border-line bg-paper"
              } ${assignable ? "cursor-pointer hover:border-brand-200" : "cursor-not-allowed opacity-60"}`}
            >
              <input
                type="checkbox"
                name="roles"
                value={role}
                checked={checked}
                disabled={!assignable}
                onChange={() => toggle(role)}
                className="mt-0.5 accent-brand-700"
              />
              <span>
                <span className="font-medium text-slate-800">{ROLE_LABELS[role]}</span>
                {!assignable && (
                  <span className="ml-2 text-xs text-slate-500">(nur Admin vergebbar)</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}
