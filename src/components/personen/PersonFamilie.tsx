"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addBeziehungAction, removeBeziehungAction } from "@/lib/personen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface VerwandtEntry {
  beziehungId: string;
  personId: string;
  label: string;
}

export interface PersonOption {
  id: string;
  label: string;
}

/**
 * Familie: Eltern/Erziehungsberechtigte dieser Person sowie deren Kinder —
 * verknüpfte Personen (können später als Rechnungsempfänger dienen, Modul 9).
 */
export function PersonFamilie({
  personId,
  eltern,
  kinder,
  candidates,
  canManage,
}: {
  personId: string;
  eltern: VerwandtEntry[];
  kinder: VerwandtEntry[];
  candidates: PersonOption[];
  canManage: boolean;
}) {
  const [addState, addFormAction] = useActionState(addBeziehungAction, idleFormState);
  const [removeState, removeFormAction] = useActionState(removeBeziehungAction, idleFormState);

  const linkedIds = new Set([
    ...eltern.map((e) => e.personId),
    ...kinder.map((k) => k.personId),
    personId,
  ]);
  const verfuegbar = candidates.filter((c) => !linkedIds.has(c.id));

  return (
    <div className="space-y-5">
      <FormAlert state={removeState} />

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Erziehungsberechtigte / Eltern
        </h3>
        <VerwandtListe eintraege={eltern} canManage={canManage} removeFormAction={removeFormAction} leerText="Keine erziehungsberechtigten Personen verknüpft." />
        {canManage && (
          <form action={addFormAction} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="kindId" value={personId} />
            <div className="min-w-56 flex-1">
              <label htmlFor={`eltern-add-${personId}`} className="label">
                Elternteil verknüpfen
              </label>
              <select id={`eltern-add-${personId}`} name="berechtigterId" required className="input" defaultValue="">
                <option value="" disabled>
                  Person wählen …
                </option>
                {verfuegbar.map((c) => (
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
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kinder</h3>
        <VerwandtListe eintraege={kinder} canManage={canManage} removeFormAction={removeFormAction} leerText="Keine Kinder verknüpft." />
        {canManage && (
          <form action={addFormAction} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="berechtigterId" value={personId} />
            <div className="min-w-56 flex-1">
              <label htmlFor={`kinder-add-${personId}`} className="label">
                Kind verknüpfen
              </label>
              <select id={`kinder-add-${personId}`} name="kindId" required className="input" defaultValue="">
                <option value="" disabled>
                  Person wählen …
                </option>
                {verfuegbar.map((c) => (
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
        )}
      </div>

      {addState.error && <FormAlert state={addState} />}
      {addState.success && <FormAlert state={addState} />}
    </div>
  );
}

function VerwandtListe({
  eintraege,
  canManage,
  removeFormAction,
  leerText,
}: {
  eintraege: VerwandtEntry[];
  canManage: boolean;
  removeFormAction: (fd: FormData) => void;
  leerText: string;
}) {
  if (eintraege.length === 0) {
    return <p className="text-sm text-slate-600">{leerText}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {eintraege.map((eintrag) => (
        <li key={eintrag.beziehungId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
          <Link href={`/personen/${eintrag.personId}`} className="font-medium text-brand-700 hover:text-brand-800">
            {eintrag.label}
          </Link>
          {canManage && (
            <form
              action={removeFormAction}
              onSubmit={(e) => {
                if (!confirm("Diese Verknüpfung lösen?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="beziehungId" value={eintrag.beziehungId} />
              <SubmitButton className="btn-secondary px-2 py-0.5 text-[11px] text-slate-500" pendingText="…">
                Lösen
              </SubmitButton>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
