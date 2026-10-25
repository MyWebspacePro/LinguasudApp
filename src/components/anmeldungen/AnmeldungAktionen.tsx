"use client";

import { useActionState } from "react";
import {
  beendeAnmeldungAction,
  erfasseFehlzeitAction,
  korrigiereGuthabenAction,
  ladeGuthabenAction,
  paketErinnernAction,
  paketVerlaengernAction,
  probeZuAktivAction,
} from "@/lib/anmeldungen/actions";
import { idleFormState } from "@/lib/forms";
import { SubmitButton } from "@/components/SubmitButton";
import { heuteDateKey } from "@/lib/zeit";

/** Probe → fest: lädt das Paket-Guthaben und startet das Zählen. */
export function ProbeZuAktivButton({ anmeldungId }: { anmeldungId: string }) {
  const [state, formAction] = useActionState(probeZuAktivAction, idleFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="anmeldungId" value={anmeldungId} />
      <SubmitButton pendingText="…">Zur festen Anmeldung umwandeln</SubmitButton>
      <InlineMeldung state={state} />
    </form>
  );
}

/** Paketende-Aktionen: fortfahren (Rechnung/Auffüllung) · beenden · erinnern. */
export function PaketEndeAktionen({
  anmeldungId,
  schwelleErreicht,
  gemeldet,
}: {
  anmeldungId: string;
  schwelleErreicht: boolean;
  gemeldet: boolean;
}) {
  const [verlaengernState, verlaengernAction] = useActionState(paketVerlaengernAction, idleFormState);
  const [beendenState, beendenAction] = useActionState(beendeAnmeldungAction, idleFormState);
  const [erinnernState, erinnernAction] = useActionState(paketErinnernAction, idleFormState);
  return (
    <div className="space-y-3">
      {schwelleErreicht && (
        <p className="alert-info text-sm">
          Paketende-Automatik: nur noch wenige Lektionen offen — Teilnehmende informieren
          («fortfahren oder beenden?»), dann Paket verlängern oder Anmeldung beenden.
          {gemeldet ? " Info/Erinnerung wurde bereits versendet." : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <form action={verlaengernAction}>
          <input type="hidden" name="anmeldungId" value={anmeldungId} />
          <SubmitButton pendingText="…">Fortfahren — Paket verlängern</SubmitButton>
        </form>
        <form action={erinnernAction}>
          <input type="hidden" name="anmeldungId" value={anmeldungId} />
          <SubmitButton className="btn-secondary" pendingText="…">
            {gemeldet ? "Erneut erinnern" : "Teilnehmende(r) informieren"}
          </SubmitButton>
        </form>
        <form action={beendenAction}>
          <input type="hidden" name="anmeldungId" value={anmeldungId} />
          <SubmitButton className="btn-danger" pendingText="…">
            Anmeldung beenden
          </SubmitButton>
        </form>
      </div>
      <InlineMeldung state={verlaengernState.success ? verlaengernState : erinnernState.success ? erinnernState : beendenState} />
    </div>
  );
}

/** Guthaben pflegen: Aufladung, Korrektur (begründet), Fehlzeit (Büro entscheidet final). */
export function GuthabenAktionen({ anmeldungId, aktiv }: { anmeldungId: string; aktiv: boolean }) {
  const [ladeState, ladeAction] = useActionState(ladeGuthabenAction, idleFormState);
  const [korrState, korrAction] = useActionState(korrigiereGuthabenAction, idleFormState);
  const [fehlState, fehlAction] = useActionState(erfasseFehlzeitAction, idleFormState);

  return (
    <div className="space-y-4">
      <form action={ladeAction} className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
        <input type="hidden" name="anmeldungId" value={anmeldungId} />
        <div>
          <label htmlFor="gut-anzahl" className="label">
            Lektionen
          </label>
          <input id="gut-anzahl" name="anzahl" type="number" min={1} max={60} required className="input w-28" placeholder="z.B. 14" />
        </div>
        <div>
          <label htmlFor="gut-bemerkung" className="label">
            Bemerkung (optional)
          </label>
          <input id="gut-bemerkung" name="bemerkung" className="input" placeholder="z.B. Nachkauf Paket" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Aufladen
          </SubmitButton>
        </div>
        <div className="sm:col-span-3">
          <InlineMeldung state={ladeState} />
        </div>
      </form>

      <form action={korrAction} className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
        <input type="hidden" name="anmeldungId" value={anmeldungId} />
        <div>
          <label htmlFor="gut-delta" className="label">
            Korrektur (±)
          </label>
          <input id="gut-delta" name="delta" type="number" min={-20} max={20} required className="input w-28" placeholder="z.B. −1" />
        </div>
        <div>
          <label htmlFor="gut-grund" className="label">
            Grund (Pflicht)
          </label>
          <input id="gut-grund" name="bemerkung" className="input" placeholder="z.B. Lektion technisch abgesagt, Gutdruck korrigiert" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Korrigieren
          </SubmitButton>
        </div>
        <div className="sm:col-span-3">
          <InlineMeldung state={korrState} />
        </div>
      </form>

      <form action={fehlAction} className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
        <input type="hidden" name="anmeldungId" value={anmeldungId} />
        <div>
          <label htmlFor="fehl-datum" className="label">
            Datum
          </label>
          <input id="fehl-datum" name="datum" type="date" defaultValue={heuteDateKey()} required className="input" />
        </div>
        <div>
          <label htmlFor="fehl-art" className="label">
            Entscheidung (final)
          </label>
          <select id="fehl-art" name="entschuldigt" defaultValue="0" className="input">
            <option value="0">unentschuldigt (−1 Lektion)</option>
            <option value="1">entschuldigt (−0, dokumentiert)</option>
          </select>
        </div>
        <div>
          <label htmlFor="fehl-bemerkung" className="label">
            Bemerkung (optional)
          </label>
          <input id="fehl-bemerkung" name="bemerkung" className="input" placeholder="z.B. Arzttermin, Entschuldigung liegt vor" />
        </div>
        <div className="flex items-end pb-0.5">
          <SubmitButton className="btn-secondary" pendingText="…">
            Erfassen
          </SubmitButton>
        </div>
        {!aktiv && (
          <p className="text-xs text-slate-500 sm:col-span-4">
            Fehlzeiten nur bei aktiven Anmeldungen.
          </p>
        )}
        <div className="sm:col-span-4">
          <InlineMeldung state={fehlState} />
        </div>
      </form>
    </div>
  );
}

function InlineMeldung({ state }: { state: { error?: string; success?: string } }) {
  if (!state.error && !state.success) return null;
  return (
    <p className={`text-xs ${state.error ? "text-red-700" : "text-emerald-700"}`}>
      {state.error ?? state.success}
    </p>
  );
}
