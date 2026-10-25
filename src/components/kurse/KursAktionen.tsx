"use client";

import { useActionState } from "react";
import {
  addNiveauWechselAction,
  addUnterbrechungAction,
  deleteKursAction,
  removeUnterbrechungAction,
  setKursStatusAction,
} from "@/lib/kurse/actions";
import type { KursStatus, KursUnterbrechungRow } from "@/lib/domain";
import { KURS_STATUS_LABELS, KURS_STATUS_WERTE } from "@/lib/domain";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { addDays, formatDatum, heuteDateKey } from "@/lib/zeit";

/** Kurs-Badge (Modul 4) — server- und clientseitig nutzbar. */
const STATUS_STILE: Record<KursStatus, string> = {
  GEPLANT: "bg-slate-100 text-slate-700",
  AKTIV: "bg-emerald-100 text-emerald-800",
  PAUSIERT: "bg-amber-100 text-amber-800",
  ABGESCHLOSSEN: "bg-slate-200 text-slate-600",
  ABGESAGT: "bg-red-100 text-red-800",
};

export function KursStatusBadge({ status }: { status: KursStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STILE[status]}`}>
      {KURS_STATUS_LABELS[status]}
    </span>
  );
}

/** Statuswechsel — nur Büro (Admin/Chef/Büro). */
export function KursStatusForm({ kursId, status }: { kursId: string; status: KursStatus }) {
  const [state, formAction] = useActionState(setKursStatusAction, idleFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kursId" value={kursId} />
      <select name="status" defaultValue={status} className="input w-auto" aria-label="Kursstatus">
        {KURS_STATUS_WERTE.map((s) => (
          <option key={s} value={s}>
            {KURS_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">
        Status setzen
      </SubmitButton>
      <span className="text-xs">
        {state.error ? <span className="text-red-700">{state.error}</span> : state.success ? <span className="text-emerald-700">{state.success}</span> : null}
      </span>
    </form>
  );
}

/**
 * Niveau-Wechsel melden (Modul 4): beendet den laufenden Abschnitt, eröffnet
 * den neuen und passt den Kurscode an — durchs Büro oder von der Lehrperson
 * gemeldet (Auslöser für Kursbestätigungen, Modul 10).
 */
export function NiveauWechselForm({
  kursId,
  niveaus,
  alsLehrperson,
}: {
  kursId: string;
  niveaus: { id: string; code: string; name: string | null }[];
  alsLehrperson: boolean;
}) {
  const [state, formAction] = useActionState(addNiveauWechselAction, idleFormState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="kursId" value={kursId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`nw-niveau-${kursId}`} className="label">
              Neues Niveau
            </label>
            <select id={`nw-niveau-${kursId}`} name="niveauId" required className="input">
              <option value="" disabled>
                Bitte wählen
              </option>
              {niveaus.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code}
                  {n.name ? ` — ${n.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`nw-datum-${kursId}`} className="label">
              Wechseldatum (Beginn des neuen Abschnitts)
            </label>
            <input
              id={`nw-datum-${kursId}`}
              name="datum"
              type="date"
              defaultValue={heuteDateKey()}
              required
              className="input"
            />
          </div>
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            {alsLehrperson ? "Niveau-Wechsel melden" : "Niveau-Wechsel erfassen"}
          </SubmitButton>
        </div>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

/** Unterbrechungen (Modul 4): Liste + Erfassung; im Planer ausgegraut + überbuchbar. */
export function UnterbrechungenPanel({
  kursId,
  unterbrechungen,
  canManage,
}: {
  kursId: string;
  unterbrechungen: KursUnterbrechungRow[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(addUnterbrechungAction, idleFormState);
  const [removeState, removeFormAction] = useActionState(removeUnterbrechungAction, idleFormState);
  const heute = heuteDateKey();

  const statusOf = (u: KursUnterbrechungRow) => {
    const von = new Date(u.von).toISOString().slice(0, 10);
    const bis = new Date(u.bis).toISOString().slice(0, 10);
    if (bis < heute) return <span className="text-xs text-slate-500">beendet</span>;
    if (von > heute) return <span className="text-xs text-sky-700">geplant</span>;
    return <span className="text-xs font-semibold text-amber-700">laufend</span>;
  };

  return (
    <div className="space-y-4">
      {unterbrechungen.length > 0 ? (
        <ul className="divide-y divide-line text-sm">
          {unterbrechungen.map((u) => {
            const von = new Date(u.von).toISOString().slice(0, 10);
            const bis = new Date(u.bis).toISOString().slice(0, 10);
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">
                    {formatDatum(von)} – {formatDatum(bis)}
                  </span>
                  {u.grund ? <span className="text-slate-600"> · {u.grund}</span> : null}
                  {u.gemeldetVonLehrperson && (
                    <span className="ml-1.5 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-700">
                      von Lehrperson gemeldet
                    </span>
                  )}
                  <span className="ml-2">{statusOf(u)}</span>
                </span>
                {canManage && (
                  <form action={removeFormAction}>
                    <input type="hidden" name="unterbrechungId" value={u.id} />
                    <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">
                      Entfernen
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Keine Unterbrechungen erfasst.</p>
      )}
      {removeState.error && <p className="text-xs text-red-700">{removeState.error}</p>}

      <form action={formAction} className="rounded-lg bg-slate-50 p-3">
        <input type="hidden" name="kursId" value={kursId} />
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Unterbrechung erfassen (Slot bleibt überbuchbar)
        </p>
        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
          <div>
            <label htmlFor={`ub-von-${kursId}`} className="label">
              Von
            </label>
            <input
              id={`ub-von-${kursId}`}
              name="von"
              type="date"
              defaultValue={heute}
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor={`ub-bis-${kursId}`} className="label">
              Bis
            </label>
            <input
              id={`ub-bis-${kursId}`}
              name="bis"
              type="date"
              defaultValue={addDays(heute, 7)}
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor={`ub-grund-${kursId}`} className="label">
              Grund (optional)
            </label>
            <input id={`ub-grund-${kursId}`} name="grund" className="input" placeholder="z.B. Schulferien, Krankheit" />
          </div>
          <div className="flex items-end pb-0.5">
            <SubmitButton className="btn-secondary" pendingText="…">
              Erfassen
            </SubmitButton>
          </div>
        </div>
        <FormAlert state={state} />
      </form>
    </div>
  );
}

/** Kurs löschen — nur wenn ohne Anmeldungen/Lektionen (sonst Status setzen). */
export function KursDeletePanel({ kursId, code }: { kursId: string; code: string }) {
  const [state, formAction] = useActionState(deleteKursAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Kurs «${code}» wirklich löschen? Das ist nur möglich, wenn er unbenutzt ist.`)) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="kursId" value={kursId} />
      <FormAlert state={state} />
      <SubmitButton className="btn-danger" pendingText="…">
        Kurs löschen
      </SubmitButton>
    </form>
  );
}
