"use client";

import { useActionState } from "react";
import { idleFormState } from "@/lib/forms";
import { savePreiseAction, saveTarifstufeAction } from "@/lib/stammdaten/actions";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

export interface TarifstufeView {
  id: string;
  name: string;
  lessonsPerPackage: number;
  middayFrom: string | null;
  middayTo: string | null;
  eveningFrom: string | null;
}

export interface TarifeManagerProps {
  tarifstufen: TarifstufeView[];
  kursarten: { id: string; name: string }[];
  dauern: { id: string; minuten: number }[];
  /** Map "kursartId:dauerId:stufeId" → Betrag als String ("1050.00") */
  preise: Record<string, string>;
  canManage: boolean;
}

/**
 * Tarife & Preisliste: Tarifstufen (Paketgrössen + Zeitfenster für die
 * Standard-Ableitung nach Tageszeit) und die Preis-Matrix
 * Kursart × Lektionsdauer × Tarifstufe — jederzeit anpassbar.
 */
export function TarifeManager({ tarifstufen, kursarten, dauern, preise, canManage }: TarifeManagerProps) {
  const [stufeState, stufeAction] = useActionState(saveTarifstufeAction, idleFormState);
  const [matrixState, matrixAction] = useActionState(savePreiseAction, idleFormState);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Tarifstufen</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-600">
          Hochtarif = 14 Lektionen/Paket (über Mittag/Abend) · Niedertarif = 15 Lektionen/Paket
          (Vormittag/Nachmittag). Die Zeitfenster steuern die automatische Vorbelegung nach
          Tageszeit; das Büro kann bei Anmeldungen jederzeit übersteuern.
        </p>

        <div className="space-y-3">
          {tarifstufen.map((stufe) => (
            <form
              key={stufe.id}
              action={stufeAction}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
            >
              <input type="hidden" name="id" value={stufe.id} />
              <div>
                <label className="label">Name</label>
                <input name="name" defaultValue={stufe.name} required className="input max-w-40" />
              </div>
              <div>
                <label className="label">Lektionen/Paket</label>
                <input name="lessonsPerPackage" type="number" min={1} max={100} defaultValue={stufe.lessonsPerPackage} required className="input max-w-28" />
              </div>
              <div>
                <label className="label">Mittag von</label>
                <input name="middayFrom" defaultValue={stufe.middayFrom ?? ""} placeholder="11:30" className="input max-w-24" />
              </div>
              <div>
                <label className="label">Mittag bis</label>
                <input name="middayTo" defaultValue={stufe.middayTo ?? ""} placeholder="13:30" className="input max-w-24" />
              </div>
              <div>
                <label className="label">Abend ab</label>
                <input name="eveningFrom" defaultValue={stufe.eveningFrom ?? ""} placeholder="17:00" className="input max-w-24" />
              </div>
              {canManage && <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Speichern</SubmitButton>}
            </form>
          ))}
        </div>
        {canManage && (
          <form action={stufeAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-3">
            <div>
              <label className="label">Neue Stufe</label>
              <input name="name" placeholder="z.B. Wochenende" required className="input max-w-40" />
            </div>
            <div>
              <label className="label">Lektionen/Paket</label>
              <input name="lessonsPerPackage" type="number" min={1} max={100} defaultValue={14} required className="input max-w-28" />
            </div>
            <SubmitButton className="btn-secondary">+ Stufe</SubmitButton>
          </form>
        )}
        <div className="mt-3">
          <FormAlert state={stufeState} />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Preisliste (CHF pro Paket)</h2>
          <p className="text-xs text-slate-600">Leere Zelle = kein Preis für diese Kombination.</p>
        </div>
        <p className="mb-4 text-xs text-slate-600">
          Preise sind jederzeit anpassbar; jede Änderung landet im Audit-Log. Beim Speichern wird
          die gesamte Matrix ersetzt.
        </p>

        <form action={matrixAction} className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-120">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Kursart</th>
                  <th className="th">Dauer</th>
                  {tarifstufen.map((s) => (
                    <th key={s.id} className="th">
                      {s.name}
                      <span className="ml-1 font-normal normal-case">({s.lessonsPerPackage} Lekt.)</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kursarten.map((kursart) =>
                  dauern.map((dauer, i) => (
                    <tr key={`${kursart.id}-${dauer.id}`}>
                      {i === 0 && (
                        <td rowSpan={dauern.length} className="td font-medium">
                          {kursart.name}
                        </td>
                      )}
                      <td className="td text-slate-600">{dauer.minuten} Min.</td>
                      {tarifstufen.map((stufe) => {
                        const key = `${kursart.id}:${dauer.id}:${stufe.id}`;
                        return (
                          <td key={stufe.id} className="td">
                            <input
                              name={`p:${key}`}
                              defaultValue={preise[key] ?? ""}
                              inputMode="decimal"
                              placeholder="—"
                              disabled={!canManage}
                              className="input max-w-28 py-1 text-right"
                              aria-label={`${kursart.name} ${dauer.minuten} Min. ${stufe.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          {canManage && <SubmitButton>Preisliste speichern</SubmitButton>}
          <FormAlert state={matrixState} />
        </form>
      </section>
    </div>
  );
}
