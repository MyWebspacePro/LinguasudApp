"use client";

// Aktionen auf einer gespeicherten Lektion (Modul 14): PDF öffnen, Freigabe
// fürs Kollegium umschalten, löschen (mit Bestätigung). Die Server Actions
// liefern FormState; Erfolg/Fehler erscheinen direkt daneben.

import { useActionState } from "react";
import { loescheKiLektionAction, teileKiLektionAction } from "@/lib/ki/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export function KiAktionen({
  id,
  geteilt,
  pdfHref,
  darfVerwalten,
}: {
  id: string;
  geteilt: boolean;
  pdfHref: string;
  darfVerwalten: boolean;
}) {
  const [teilState, teilAction] = useActionState(teileKiLektionAction, idleFormState);
  const [loeschState, loeschAction] = useActionState(loescheKiLektionAction, idleFormState);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={pdfHref} target="_blank" rel="noreferrer" className="btn-secondary">
          PDF öffnen
        </a>

        {darfVerwalten && (
          <form action={teilAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="geteilt" value={geteilt ? "false" : "true"} />
            <SubmitButton className="btn-secondary" pendingText="…">
              {geteilt ? "Freigabe entfernen" : "Für Kollegium freigeben"}
            </SubmitButton>
          </form>
        )}
      </div>

      <FormAlert state={teilState} />

      {darfVerwalten && (
        <form action={loeschAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="bestaetigt" required className="h-4 w-4 rounded border-line" />
            Löschen endgültig bestätigen
          </label>
          <SubmitButton className="btn-secondary text-brand-700" pendingText="Löscht …">
            Lektion löschen
          </SubmitButton>
        </form>
      )}
      <FormAlert state={loeschState} />
    </div>
  );
}
