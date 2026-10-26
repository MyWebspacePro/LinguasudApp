"use client";

// Serien-Sektion der Vermietungs-Übersicht (Modul 12): eigene Client-
// Komponente, damit die Löschen-Meldung das Revalidate (Zeile verschwindet
// aus der Server-Liste) überlebt — der Alert hängt auf Sektions-Ebene.

import { useActionState } from "react";
import { loescheSerieAction } from "@/lib/vermietung/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface SerienZeile {
  id: string;
  mieterName: string;
  raumName: string;
  wochentagLabel: string;
  startZeit: string;
  endZeit: string;
  zeitraumLabel: string;
  totalTermine: number;
  kommendeGeplante: string | null;
  preisLabel: string;
  notiz: string | null;
}

export function SerienSektion({ serien }: { serien: readonly SerienZeile[] }) {
  const [state, formAction] = useActionState(loescheSerieAction, idleFormState);

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">Serien</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Materialisierte Termine sind einzeln absagbar/löschbar — sie erscheinen in der Terminliste.
      </p>
      {/* Persistent: nach dem Löschen entfernt das Revalidate die Zeile —
          die Meldung muss auf Sektions-Ebene überleben. */}
      <div className="mt-2">
        <FormAlert state={state} />
      </div>
      {serien.length > 0 ? (
        <ul className="mt-1 divide-y divide-line">
          {serien.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {s.mieterName} · Raum {s.raumName}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {s.wochentagLabel} · {s.startZeit}–{s.endZeit} · {s.zeitraumLabel} · {s.totalTermine} Termine à{" "}
                  {s.preisLabel} CHF
                  {s.kommendeGeplante ? ` · nächste geplante: ${s.kommendeGeplante}` : ""}
                </p>
                {s.notiz && <p className="mt-0.5 text-xs text-slate-500">{s.notiz}</p>}
              </div>
              <form
                action={formAction}
                onSubmit={(e) => {
                  if (!confirm(`Serie (${s.mieterName} · ${s.wochentagLabel}) löschen? Geplante Termine ohne Rechnung werden mitgelöscht.`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="serieId" value={s.id} />
                <SubmitButton className="btn-danger px-3 py-1.5 text-xs" pendingText="…">
                  Serie löschen
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Noch keine Serien.</p>
      )}
    </section>
  );
}
