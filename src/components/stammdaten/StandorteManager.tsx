"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms";
import { idleFormState } from "@/lib/forms";
import {
  deleteEntityAction,
  saveEtageAction,
  saveRaumAction,
  saveStandortAction,
  setActiveAction,
  setArchivedAction,
} from "@/lib/stammdaten/actions";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface RaumNode {
  id: string;
  name: string;
  seats: number;
  active: boolean;
  archived: boolean;
}

export interface EtageNode {
  id: string;
  name: string;
  sortOrder: number;
  raeume: RaumNode[];
}

export interface StandortNode {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  active: boolean;
  archived: boolean;
  etagen: EtageNode[];
}

/**
 * Hierarchischer Standort-Editor: Standort → Etage → Raum.
 * Löschen ist nur «unten» möglich, wenn keine Kinder hängen (prüft die Action).
 */
export function StandorteManager({
  standorte,
  canManage,
}: {
  standorte: StandortNode[];
  canManage: boolean;
}) {
  const [createState, createAction] = useActionState(saveStandortAction, idleFormState);
  const [notice, setNotice] = useState<FormState>({});

  return (
    <div className="space-y-4">
      {canManage && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Standort hinzufügen</h2>
          <form action={createAction} className="space-y-4">
            <FormAlert state={createState} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="s-name" className="label">Name</label>
                <input id="s-name" name="name" required placeholder="z.B. Vorstadt 18" className="input" />
              </div>
              <div>
                <label htmlFor="s-strasse" className="label">Strasse</label>
                <input id="s-strasse" name="strasse" required placeholder="Vorstadt 18" className="input" />
              </div>
              <div>
                <label htmlFor="s-plz" className="label">PLZ</label>
                <input id="s-plz" name="plz" required placeholder="8200" className="input" />
              </div>
              <div>
                <label htmlFor="s-ort" className="label">Ort</label>
                <input id="s-ort" name="ort" required placeholder="Schaffhausen" className="input" />
              </div>
              <div className="flex items-end">
                <SubmitButton>Hinzufügen</SubmitButton>
              </div>
            </div>
          </form>
        </section>
      )}

      <FormAlert state={notice} />

      <div className="space-y-4">
        {standorte.map((standort) => (
          <StandortCard key={standort.id} standort={standort} canManage={canManage} setNotice={setNotice} />
        ))}
        {standorte.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-600">Noch keine Standorte angelegt.</p>
        )}
      </div>
    </div>
  );
}

function StandortCard({
  standort,
  canManage,
  setNotice,
}: {
  standort: StandortNode;
  canManage: boolean;
  setNotice: (s: FormState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveStandortAction(prev, fd);
    if (result.success) {
      setNotice(result);
      setEditing(false);
    }
    return result;
  }, idleFormState);
  const raumCount = standort.etagen.reduce((sum, e) => sum + e.raeume.length, 0);

  return (
    <section className={`card ${standort.archived ? "opacity-70" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        {editing ? (
          <form action={editAction} className="flex w-full flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={standort.id} />
            <input name="name" defaultValue={standort.name} required className="input max-w-44" aria-label="Name" />
            <input name="strasse" defaultValue={standort.strasse} required className="input max-w-56" aria-label="Strasse" />
            <input name="plz" defaultValue={standort.plz} required className="input max-w-24" aria-label="PLZ" />
            <input name="ort" defaultValue={standort.ort} required className="input max-w-40" aria-label="Ort" />
            <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Speichern</SubmitButton>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(false)}>
              Abbrechen
            </button>
          </form>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {standort.name}
                {standort.archived && <span className="ml-2 text-xs font-normal text-slate-500">(archiviert)</span>}
              </h2>
              <p className="text-xs text-slate-600">
                {standort.strasse}, {standort.plz} {standort.ort} · {standort.etagen.length} Etagen · {raumCount} Räume ·{" "}
                {standort.active ? (
                  <span className="font-medium text-emerald-700">aktiv</span>
                ) : (
                  <span>inaktiv</span>
                )}
              </p>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setEditing(true)}>
                  Bearbeiten
                </button>
                <MiniForm
                  action={setActiveAction}
                  fields={{ entity: "standort", id: standort.id, active: String(!standort.active) }}
                  className={standort.active ? "btn-secondary" : "btn-primary"}
                  label={standort.active ? "Deaktivieren" : "Aktivieren"}
                />
                <MiniForm
                  action={setArchivedAction}
                  fields={{ entity: "standort", id: standort.id, archived: String(!standort.archived) }}
                  label={standort.archived ? "Reaktivieren" : "Archivieren"}
                  onDone={setNotice}
                />
                <MiniForm
                  action={deleteEntityAction}
                  fields={{ entity: "standort", id: standort.id }}
                  label="Löschen"
                  className="btn-danger"
                  confirm="Standort endgültig löschen? (Nur möglich ohne Etagen.)"
                  onDone={setNotice}
                />
              </div>
            )}
          </>
        )}
        {editing && <div className="w-full"><FormAlert state={editState} /></div>}
      </header>

      <div className="space-y-5 px-5 py-4">
        {standort.etagen.map((etage) => (
          <EtageBlock key={etage.id} etage={etage} canManage={canManage} setNotice={setNotice} />
        ))}
        {standort.etagen.length === 0 && (
          <p className="text-sm text-slate-600">Noch keine Etagen.</p>
        )}
        {canManage && <AddEtage standortId={standort.id} />}
      </div>
    </section>
  );
}

function EtageBlock({
  etage,
  canManage,
  setNotice,
}: {
  etage: EtageNode;
  canManage: boolean;
  setNotice: (s: FormState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveEtageAction(prev, fd);
    if (result.success) {
      setNotice(result);
      setEditing(false);
    }
    return result;
  }, idleFormState);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {editing ? (
            <form action={editAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={etage.id} />
              <input name="name" defaultValue={etage.name} required className="input max-w-40 py-1 text-xs" aria-label="Etagenname" />
              <input name="sortOrder" type="number" defaultValue={etage.sortOrder} className="input max-w-20 py-1 text-xs" aria-label="Sortierung" />
              <SubmitButton className="btn-primary px-2.5 py-1 text-xs">Speichern</SubmitButton>
              <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
            </form>
          ) : (
            <button type="button" className="cursor-pointer hover:text-brand-800" onClick={() => canManage && setEditing(true)}>
              {etage.name}
            </button>
          )}
        </h3>
        {canManage && !editing && (
          <MiniForm
            action={deleteEntityAction}
            fields={{ entity: "etage", id: etage.id }}
            label="Etage löschen"
            className="btn-danger"
            confirm="Diese Etage löschen? (Nur möglich ohne Räume.)"
            onDone={setNotice}
          />
        )}
      </div>
      {editing && <FormAlert state={editState} />}

      <div className="flex flex-wrap gap-2">
        {etage.raeume.map((raum) => (
          <RaumChip key={raum.id} raum={raum} etageId={etage.id} canManage={canManage} setNotice={setNotice} />
        ))}
        {etage.raeume.length === 0 && <p className="text-sm text-slate-600">Keine Räume auf dieser Etage.</p>}
        {canManage && <AddRaum etageId={etage.id} />}
      </div>
    </div>
  );
}

function RaumChip({
  raum,
  etageId,
  canManage,
  setNotice,
}: {
  raum: RaumNode;
  etageId: string;
  canManage: boolean;
  setNotice: (s: FormState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveRaumAction(prev, fd);
    if (result.success) {
      setNotice(result);
      setEditing(false);
    }
    return result;
  }, idleFormState);

  if (editing) {
    return (
      <form action={editAction} className="flex items-end gap-2 rounded-lg border border-brand-200 bg-brand-50/50 p-2">
        <input type="hidden" name="id" value={raum.id} />
        <input type="hidden" name="etageId" value={etageId} />
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-600">Name</label>
          <input name="name" defaultValue={raum.name} required className="input max-w-32 py-1 text-xs" />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-slate-600">Plätze</label>
          <input name="seats" type="number" min={0} defaultValue={raum.seats} required className="input max-w-20 py-1 text-xs" />
        </div>
        <SubmitButton className="btn-primary px-2.5 py-1 text-xs">OK</SubmitButton>
        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setEditing(false)}>
          ✕
        </button>
        <FormAlert state={editState} />
      </form>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
        raum.archived
          ? "border-line bg-surface text-slate-500"
          : raum.active
            ? "border-line bg-paper text-slate-800"
            : "border-line bg-surface text-slate-500"
      }`}
    >
      <span className="font-medium">{raum.name}</span>
      <span className="text-xs text-slate-600">{raum.seats} Plätze</span>
      {!raum.active && <span className="text-[10px] text-slate-500 uppercase">inaktiv</span>}
      {raum.archived && <span className="text-[10px] text-slate-500 uppercase">archiviert</span>}
      {canManage && (
        <span className="flex gap-1">
          <button type="button" className="cursor-pointer text-xs text-brand-700 hover:text-brand-800" onClick={() => setEditing(true)}>
            ✎
          </button>
          <MiniForm
            action={setActiveAction}
            fields={{ entity: "raum", id: raum.id, active: String(!raum.active) }}
            label={raum.active ? "○" : "●"}
            className="cursor-pointer rounded px-1 text-xs text-slate-500 hover:text-brand-700"
            title={raum.active ? "Deaktivieren" : "Aktivieren"}
            onDone={setNotice}
          />
          <MiniForm
            action={setArchivedAction}
            fields={{ entity: "raum", id: raum.id, archived: String(!raum.archived) }}
            label="🗄"
            className="cursor-pointer rounded px-1 text-xs text-slate-500 hover:text-brand-700"
            title={raum.archived ? "Aus dem Archiv holen" : "Archivieren"}
            onDone={setNotice}
          />
          <MiniForm
            action={deleteEntityAction}
            fields={{ entity: "raum", id: raum.id }}
            label="🗑"
            className="cursor-pointer rounded px-1 text-xs text-slate-500 hover:text-red-700"
            title="Löschen"
            confirm={`Raum «${raum.name}» endgültig löschen?`}
            onDone={setNotice}
          />
        </span>
      )}
    </span>
  );
}

function AddEtage({ standortId }: { standortId: string }) {
  const [state, action] = useActionState(saveEtageAction, idleFormState);
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="standortId" value={standortId} />
      <div>
        <label className="mb-0.5 block text-[11px] text-slate-600">Neue Etage</label>
        <input name="name" placeholder="z.B. 3. Stock" required className="input max-w-40 py-1 text-xs" />
      </div>
      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs">+ Etage</SubmitButton>
      <FormAlert state={state} />
    </form>
  );
}

function AddRaum({ etageId }: { etageId: string }) {
  const [state, action] = useActionState(saveRaumAction, idleFormState);
  return (
    <form action={action} className="flex items-end gap-2 rounded-lg border border-dashed border-line px-2.5 py-1.5">
      <input type="hidden" name="etageId" value={etageId} />
      <div>
        <label className="mb-0.5 block text-[11px] text-slate-600">Raum</label>
        <input name="name" placeholder="z.B. Oxford" required className="input max-w-32 py-1 text-xs" />
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] text-slate-600">Plätze</label>
        <input name="seats" type="number" min={0} placeholder="0" required className="input max-w-20 py-1 text-xs" />
      </div>
      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs">+ Raum</SubmitButton>
      <FormAlert state={state} />
    </form>
  );
}

/** Mini-Form für Einzelaktionen (Toggle/Archiv/Löschen). */
function MiniForm({
  action,
  fields,
  label,
  className = "btn-secondary px-2.5 py-1 text-xs",
  confirm,
  title,
  onDone,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  className?: string;
  confirm?: string;
  title?: string;
  onDone?: (s: FormState) => void;
}) {
  const [, formAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await action(prev, fd);
    onDone?.(result);
    return result;
  }, idleFormState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} title={title} pendingText="…">
        {label}
      </SubmitButton>
    </form>
  );
}
