import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewHonorare } from "@/lib/auth/permissions";
import { dateKeyOf, formatDatum, heuteDateKey } from "@/lib/zeit";
import { formatChf, istMonatKey, monatLabel, naechsterMonat, vorigerMonat } from "@/lib/honorare/logik";
import { ladeDefaultStundensatz, ladeMonatsAbrechnung } from "@/lib/honorare/abrechnung";
import { HonorarMarkieren, HonorarWiederOeffnen } from "@/components/honorare/HonorarFormen";

export const metadata: Metadata = {
  title: "Honorarabrechnung",
};

/** Honorar-Modul (Modul 11): Monats-Workflow «Lektionsliste × Sätze → Total → bezahlt». */
export default function HonorarePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <HonorareContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HonorareContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewHonorare(roles)) {
    return (
      <div className="card p-5 text-sm text-slate-600">
        Die Honorarabrechnung ist Admin, Chef und Büro vorbehalten.
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const monatParam = typeof params.monat === "string" ? params.monat : "";
  const monat = istMonatKey(monatParam) ? monatParam : heuteDateKey().slice(0, 7);

  const [{ gruppen, ohneLehrperson }, defaultSatz] = await Promise.all([
    ladeMonatsAbrechnung(monat),
    ladeDefaultStundensatz(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Honorarabrechnung</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Nur durchgeführte Lektionen (Modul 7) zählen; Absenzen von Teilnehmenden zählen normal.
          </p>
        </div>
        <Link href="/honorare/saetze" className="btn-secondary px-3 py-1.5 text-sm">
          Honorar-Matrix
        </Link>
      </div>

      {/* Monats-Wahl */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <Link href={`/honorare?monat=${vorigerMonat(monat)}`} className="btn-secondary px-2.5 py-1 text-sm" aria-label="Voriger Monat">
          ‹
        </Link>
        <form method="get" action="/honorare" className="flex items-center gap-2">
          <label htmlFor="monat" className="text-sm font-medium text-slate-700">
            Monat
          </label>
          <input
            id="monat"
            type="month"
            name="monat"
            defaultValue={monat}
            className="input w-40"
            required
          />
          <button type="submit" className="btn-secondary px-3 py-1.5 text-sm">
            Anzeigen
          </button>
        </form>
        <Link href={`/honorare?monat=${naechsterMonat(monat)}`} className="btn-secondary px-2.5 py-1 text-sm" aria-label="Nächster Monat">
          ›
        </Link>
        <span className="ml-auto text-sm font-semibold text-slate-900">{monatLabel(monat)}</span>
      </div>

      {/* Konfigurations-Hinweise */}
      {defaultSatz === null ? (
        <div className="alert-error" role="alert">
          Kein Default-Stundensatz gepflegt — Lektionen ohne individuelle Abweichung können nicht
          abgerechnet werden.{" "}
          <Link href="/honorare/saetze" className="font-medium underline">
            Honorar-Matrix öffnen
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Globaler Default-Stundensatz: <span className="font-semibold">CHF {formatChf(defaultSatz)}</span> / Stunde
          (individuelle Abweichungen in der{" "}
          <Link href="/honorare/saetze" className="font-medium text-brand-700 hover:text-brand-800">
            Honorar-Matrix
          </Link>
          ).
        </p>
      )}
      {ohneLehrperson > 0 && (
        <div className="alert-error" role="alert">
          {ohneLehrperson} durchgeführte Lektion{ohneLehrperson === 1 ? "" : "en"} ohne Lehrperson im
          Monat {monatLabel(monat)} — nicht abrechenbar. Bitte Kurs-Lehrperson bzw. Lektionen nachtragen.
        </div>
      )}

      {/* Lektionslisten pro Lehrperson */}
      {gruppen.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Keine durchgeführten Lektionen im {monatLabel(monat)}.
        </div>
      ) : (
        <div className="space-y-4">
          {gruppen.map(({ monat: gruppe, abrechnung }) => {
            const bezahlt = abrechnung?.status === "BEZAHLT";
            return (
              <section key={gruppe.lehrpersonId} className="card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {gruppe.lehrpersonName}
                      {gruppe.kuerzel ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          {gruppe.kuerzel}
                        </span>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {gruppe.zeilen.length} durchgeführte Lektion{gruppe.zeilen.length === 1 ? "" : "en"} ·{" "}
                      Total <span className="font-semibold text-slate-900">CHF {formatChf(gruppe.totalChf)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        bezahlt
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                      }
                    >
                      {bezahlt ? "bezahlt" : "offen"}
                    </span>
                    <Link
                      href={`/honorare/${gruppe.lehrpersonId}/${monat}/pdf`}
                      className="btn-secondary px-2.5 py-1 text-xs"
                      target="_blank"
                      rel="noopener"
                    >
                      PDF-Beleg
                    </Link>
                    {bezahlt ? (
                      <HonorarWiederOeffnen lehrpersonId={gruppe.lehrpersonId} monat={monat} />
                    ) : (
                      <HonorarMarkieren
                        lehrpersonId={gruppe.lehrpersonId}
                        monat={monat}
                        totalChf={gruppe.totalChf.toFixed(2)}
                        anzahl={gruppe.zeilen.length}
                        ohneSatz={gruppe.ohneSatz}
                      />
                    )}
                  </div>
                </header>

                {abrechnung?.abweichendVonSnapshot && (
                  <p className="border-b border-line bg-amber-50 px-5 py-2 text-xs text-amber-800">
                    Die Lektionsliste hat sich seit dem Markieren geändert (Snapshot: CHF{" "}
                    {formatChf(abrechnung.totalChf)}, {abrechnung.lektionenAnzahl} Lektionen am{" "}
                    {abrechnung.bezahltAt ? formatDatum(dateKeyOf(abrechnung.bezahltAt)) : "—"} durch{" "}
                    {abrechnung.actorName}) — bitte erneut prüfen und allfällig wieder öffnen.
                  </p>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase">
                        <th className="px-5 py-2 font-semibold">Datum</th>
                        <th className="px-3 py-2 font-semibold">Kurs</th>
                        <th className="px-3 py-2 text-right font-semibold">Dauer</th>
                        <th className="px-3 py-2 text-right font-semibold">Satz/h</th>
                        <th className="px-5 py-2 text-right font-semibold">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gruppe.zeilen.map((z) => (
                        <tr key={z.lektionId} className="border-t border-line/60">
                          <td className="whitespace-nowrap px-5 py-2 tabular-nums">{formatDatum(z.datumKey)}</td>
                          <td className="px-3 py-2">
                            {z.kursBezeichnung}{" "}
                            <span className="text-xs text-slate-500">{z.kursCode}</span>
                            {z.betragChf === null && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                                kein Satz
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{z.dauerMinuten} Min</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {z.stundensatz !== null ? `CHF ${formatChf(z.stundensatz)}` : "—"}
                            {z.satzQuelle === "DEFAULT" && (
                              <span className="ml-1 text-xs text-slate-400">(Default)</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2 text-right font-medium tabular-nums">
                            {z.betragChf !== null ? `CHF ${formatChf(z.betragChf)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-line">
                        <td colSpan={4} className="px-5 py-2 text-right font-semibold text-slate-700">
                          Total
                        </td>
                        <td className="px-5 py-2 text-right font-semibold tabular-nums">
                          CHF {formatChf(gruppe.totalChf)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

