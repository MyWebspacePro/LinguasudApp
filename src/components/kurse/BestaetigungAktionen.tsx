"use client";

import { useActionState } from "react";
import {
  erzeugeBestaetigungenAction,
  loescheBestaetigungAction,
} from "@/lib/bestaetigungen/actions";
import { idleFormState } from "@/lib/forms";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Kursbestätigungen (Modul 10) im Niveau-Verlauf der Kurs-Detailseite:
 * Erzeugen/Aktualisieren durchs Büro (jederzeit — beim laufenden Abschnitt
 * endet der bestätigte Zeitraum am heutigen Tag).
 */
export function BestaetigungenForm({ verlaufId, laufend }: { verlaufId: string; laufend: boolean }) {
  const [state, formAction] = useActionState(erzeugeBestaetigungenAction, idleFormState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="verlaufId" value={verlaufId} />
      <SubmitButton
        className="btn-secondary px-2.5 py-1 text-xs"
        pendingText="…"
      >
        {laufend ? "Bestätigungen (laufend) erzeugen" : "Bestätigungen erzeugen"}
      </SubmitButton>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}

/** Einzelne Bestätigung löschen (Büro) — mit Bestätigungsdialog. */
export function BestaetigungLoeschen({
  bestaetigungId,
  personName,
}: {
  bestaetigungId: string;
  personName: string;
}) {
  const [state, formAction] = useActionState(loescheBestaetigungAction, idleFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Bestätigung für ${personName} wirklich löschen?`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="bestaetigungId" value={bestaetigungId} />
      <SubmitButton className="text-xs text-slate-400 transition hover:text-red-600" pendingText="…">
        ✕
      </SubmitButton>
      {state.error ? <span className="ml-1 text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
