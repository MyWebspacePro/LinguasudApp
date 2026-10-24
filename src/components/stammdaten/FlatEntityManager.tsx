"use client";

import { useActionState, useState } from "react";
import type { EntityConfig, FieldDef, FlatEntityKey } from "@/lib/stammdaten/entities";
import type { FormState } from "@/lib/forms";
import { idleFormState } from "@/lib/forms";
import {
  deleteEntityAction,
  saveDauerAction,
  saveKostentraegerAction,
  saveKursartAction,
  saveNiveauAction,
  saveSpracheAction,
  setActiveAction,
  setArchivedAction,
} from "@/lib/stammdaten/actions";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

type SaveAction = (prev: FormState, formData: FormData) => Promise<FormState>;

const SAVE_ACTIONS: Record<FlatEntityKey, SaveAction> = {
  sprache: saveSpracheAction,
  niveau: saveNiveauAction,
  kursart: saveKursartAction,
  dauer: saveDauerAction,
  kostentraeger: saveKostentraegerAction,
};

export type RowValue = string | number | boolean | null;

export interface FlatRow {
  id: string;
  active: boolean;
  archived: boolean;
  values: Record<string, RowValue>;
}

/**
 * Generischer Stammdaten-Manager: Anlegen, Bearbeiten (inline), aktivieren/
 * deaktivieren, archivieren, löschen (nur wenn unbenutzt — prüft die Action).
 */
export function FlatEntityManager({
  config,
  rows,
  canManage,
}: {
  config: EntityConfig;
  rows: FlatRow[];
  canManage: boolean;
}) {
  const save = SAVE_ACTIONS[config.key];
  const [createState, createFormAction] = useActionState(save, idleFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, editFormAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await save(prev, fd);
    if (result.success) setEditingId(null);
    return result;
  }, idleFormState);
  const [toggleState, toggleFormAction] = useActionState(setActiveAction, idleFormState);
  const [archiveState, archiveFormAction] = useActionState(setArchivedAction, idleFormState);
  const [deleteState, deleteFormAction] = useActionState(deleteEntityAction, idleFormState);
  const [showArchived, setShowArchived] = useState(false);

  const activeRows = rows.filter((r) => !r.archived);
  const archivedRows = rows.filter((r) => r.archived);

  return (
    <div className="space-y-4">
      {canManage && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">{config.labelOne} hinzufügen</h2>
          <form action={createFormAction} className="space-y-4" key={createState.success ?? "idle"}>
            <FormAlert state={createState} />
            <FieldGrid fields={config.fields} />
            <SubmitButton>Hinzufügen</SubmitButton>
          </form>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-160">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              {config.fields.map((f) => (
                <th key={f.name} className="th">
                  {f.label}
                </th>
              ))}
              <th className="th">Status</th>
              {canManage && <th className="th text-right">Aktionen</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {activeRows.map((row) =>
              editingId === row.id ? (
                <tr key={row.id} className="bg-brand-50/40">
                  <td colSpan={config.fields.length + (canManage ? 2 : 1)}>
                    <form action={editFormAction} className="flex flex-wrap items-end gap-3 py-1">
                      <input type="hidden" name="id" value={row.id} />
                      <FieldGrid fields={config.fields} defaults={row.values} compact />
                      <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Speichern</SubmitButton>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Abbrechen
                      </button>
                    </form>
                    <div className="mt-2">
                      <FormAlert state={editState} />
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className={row.active ? "" : "text-slate-500"}>
                  {config.fields.map((f) => (
                    <td key={f.name} className={`td ${f.narrow ? "whitespace-nowrap" : ""}`}>
                      <CellValue field={f} value={row.values[f.name]} />
                    </td>
                  ))}
                  <td className="td whitespace-nowrap">
                    {row.active ? (
                      <span className="font-medium text-emerald-700">aktiv</span>
                    ) : (
                      <span>inaktiv</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="td">
                      <RowActions
                        entity={config.key}
                        row={row}
                        onEdit={() => setEditingId(row.id)}
                        toggleFormAction={toggleFormAction}
                        archiveFormAction={archiveFormAction}
                        deleteFormAction={deleteFormAction}
                      />
                    </td>
                  )}
                </tr>
              ),
            )}
            {activeRows.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={config.fields.length + (canManage ? 2 : 1)}>
                  Noch keine Einträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {(toggleState.error || toggleState.success || archiveState.error || archiveState.success || deleteState.error || deleteState.success) && (
        <div className="space-y-2">
          <FormAlert state={toggleState} />
          <FormAlert state={archiveState} />
          <FormAlert state={deleteState} />
        </div>
      )}

      {archivedRows.length > 0 && (
        <section className="card p-4">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-slate-700"
            onClick={() => setShowArchived((v) => !v)}
          >
            <span>Archiv ({archivedRows.length})</span>
            <span className="text-slate-500">{showArchived ? "einklappen ▲" : "ausklappen ▼"}</span>
          </button>
          {showArchived && (
            <ul className="mt-3 space-y-1.5">
              {archivedRows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                  <span>
                    {config.fields.map((f) => formatValue(f, row.values[f.name])).join(" · ")}
                  </span>
                  {canManage && (
                    <span className="flex gap-2">
                      <form action={archiveFormAction}>
                        <input type="hidden" name="entity" value={config.key} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="archived" value="false" />
                        <SubmitButton className="btn-secondary px-2.5 py-1 text-xs">Reaktivieren</SubmitButton>
                      </form>
                      <form action={deleteFormAction}>
                        <input type="hidden" name="entity" value={config.key} />
                        <input type="hidden" name="id" value={row.id} />
                        <SubmitButton className="btn-danger px-2.5 py-1 text-xs">Löschen</SubmitButton>
                      </form>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function RowActions({
  entity,
  row,
  onEdit,
  toggleFormAction,
  archiveFormAction,
  deleteFormAction,
}: {
  entity: FlatEntityKey;
  row: FlatRow;
  onEdit: () => void;
  /** Dispatch aus useActionState (nimmt FormData, liefert void). */
  toggleFormAction: (fd: FormData) => void;
  archiveFormAction: (fd: FormData) => void;
  deleteFormAction: (fd: FormData) => void;
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
      <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={onEdit}>
        Bearbeiten
      </button>
      <form action={toggleFormAction}>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="active" value={row.active ? "false" : "true"} />
        <SubmitButton className="btn-secondary px-2.5 py-1 text-xs">
          {row.active ? "Deaktivieren" : "Aktivieren"}
        </SubmitButton>
      </form>
      <form action={archiveFormAction}>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="archived" value="true" />
        <SubmitButton className="btn-secondary px-2.5 py-1 text-xs">Archivieren</SubmitButton>
      </form>
      <form
        action={deleteFormAction}
        onSubmit={(e) => {
          if (!confirm("Diesen Eintrag endgültig löschen?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={row.id} />
        <SubmitButton className="btn-danger px-2.5 py-1 text-xs">Löschen</SubmitButton>
      </form>
    </span>
  );
}

/** Felder als Grid (Anlegen + Inline-Bearbeitung). */
function FieldGrid({
  fields,
  defaults,
  compact,
}: {
  fields: FieldDef[];
  defaults?: Record<string, RowValue>;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "flex-1 sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {fields.map((f) => {
        const id = `f-${f.name}-${defaults ? defaults.id ?? "new" : "new"}`;
        const def = defaults?.[f.name];
        return (
          <div key={f.name} className={f.type === "checkbox" ? "flex items-end pb-1.5" : ""}>
            {f.type === "checkbox" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name={f.name}
                  defaultChecked={def === undefined ? true : Boolean(def)}
                  className="h-4 w-4 accent-brand-700"
                />
                {f.label}
              </label>
            ) : (
              <>
                <label htmlFor={id} className="label">
                  {f.label}
                  {f.required ? "" : " (optional)"}
                </label>
                {f.type === "select" ? (
                  <select id={id} name={f.name} className="input" defaultValue={String(def ?? f.options?.[0]?.value ?? "")}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    name={f.name}
                    type={f.type === "number" ? "number" : "text"}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    min={f.min}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={def === null || def === undefined ? "" : String(def)}
                    className="input"
                  />
                )}
                {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CellValue({ field, value }: { field: FieldDef; value: RowValue }) {
  if (field.type === "checkbox") {
    return value ? "Ja" : "Nein";
  }
  if (field.type === "number" && field.optionalNumber && (value === null || value === "")) {
    return <span className="text-slate-600">individuell</span>;
  }
  return <>{formatValue(field, value)}</>;
}

function formatValue(field: FieldDef, value: RowValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "select") {
    return field.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  return String(value);
}
