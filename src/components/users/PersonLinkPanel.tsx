"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Anrede } from "@/lib/domain";
import { ANREDE_LABELS, ANREDE_WERTE } from "@/lib/domain";
import {
  createPersonForUserAction,
  linkUserPersonAction,
  unlinkUserPersonAction,
} from "@/lib/users/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface PersonLinkOption {
  id: string;
  label: string;
}

/**
 * Verknüpfung Konto ↔ Person der Kartei (Modul 3): bestehende Person zuordnen
 * oder direkt aus den Kontodaten neu anlegen; E-Mails bleiben synchron.
 */
export function PersonLinkPanel({
  userId,
  person,
  candidates,
  canEdit,
}: {
  userId: string;
  person: { id: string; label: string } | null;
  candidates: PersonLinkOption[];
  canEdit: boolean;
}) {
  const [linkState, linkFormAction] = useActionState(linkUserPersonAction, idleFormState);
  const [unlinkState, unlinkFormAction] = useActionState(unlinkUserPersonAction, idleFormState);
  const [createState, createFormAction] = useActionState(createPersonForUserAction, idleFormState);

  return (
    <div className="space-y-4">
      <FormAlert state={unlinkState} />

      {person ? (
        <div className="space-y-2 text-sm">
          <p className="text-slate-700">
            Verknüpft mit{" "}
            <Link href={`/personen/${person.id}`} className="font-medium text-brand-700 hover:text-brand-800">
              {person.label}
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            Änderungen an der E-Mail werden automatisch auf beiden Seiten synchron gehalten.
          </p>
          {canEdit && (
            <form
              action={unlinkFormAction}
              onSubmit={(e) => {
                if (!confirm("Verknüpfung lösen? Das Konto und die Person bleiben bestehen.")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="userId" value={userId} />
              <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">
                Verknüpfung lösen
              </SubmitButton>
            </form>
          )}
        </div>
      ) : canEdit ? (
        <>
          <form action={linkFormAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={userId} />
            <div className="min-w-56 flex-1">
              <label htmlFor={`person-link-${userId}`} className="label">
                Bestehende Person verknüpfen
              </label>
              <select id={`person-link-${userId}`} name="personId" required className="input" defaultValue="">
                <option value="" disabled>
                  Person wählen …
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton className="btn-secondary" pendingText="…">
              Verknüpfen
            </SubmitButton>
          </form>

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs text-slate-600">
              Gibt es die Person noch nicht in der Kartei, wird sie aus den Kontodaten angelegt.
            </p>
            <form action={createFormAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={userId} />
              <div>
                <label htmlFor={`person-anrede-${userId}`} className="label">
                  Anrede
                </label>
                <select id={`person-anrede-${userId}`} name="anrede" required className="input" defaultValue="">
                  <option value="" disabled>
                    Bitte wählen
                  </option>
                  {ANREDE_WERTE.map((a: Anrede) => (
                    <option key={a} value={a}>
                      {ANREDE_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn-secondary" pendingText="…">
                Person anlegen & verknüpfen
              </SubmitButton>
            </form>
          </div>
          {linkState.error && <FormAlert state={linkState} />}
          {linkState.success && <FormAlert state={linkState} />}
          {createState.error && <FormAlert state={createState} />}
          {createState.success && <FormAlert state={createState} />}
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Keine Person verknüpft. Die Zuordnung kann durch Büro/Admin erfolgen.
        </p>
      )}
    </div>
  );
}
