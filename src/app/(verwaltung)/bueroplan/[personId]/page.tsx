import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, fromDbTime, type Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageBueroplan } from "@/lib/auth/permissions";
import { RoleBadge } from "@/components/RoleBadge";
import { dateKeyOf, formatDatum, heuteDateKey, tageZwischen, WOCHENTAG_NAMEN } from "@/lib/zeit";
import {
  BUERO_ABWEICHUNG_LABELS,
  BUERO_ABWESENHEIT_LABELS,
  BUERO_URLAUB_DEFAULT_TAGE,
  diensteFuerWochentag,
  kontingentFuerJahr,
  urlaubRest,
  urlaubstageImJahr,
  type AbwesenheitBereich,
  type DienstBlock,
} from "@/lib/bueroplan/logik";
import { ladeBueroperson } from "@/lib/bueroplan/personen";
import {
  AbweichungForm,
  AbwesenheitForm,
  DienstForm,
  KontingentForm,
  LoeschForm,
} from "@/components/bueroplan/BueroplanFormen";
import { deleteAbweichungAction, deleteAbwesenheitAction, deleteDienstAction } from "@/lib/bueroplan/actions";

export const metadata: Metadata = {
  title: "Büroplan — Pensum & Abwesenheiten",
};

/** Reines Datumsfeld (UTC-Mitternacht) → Kalendertags-Key (Europe/Zurich). */
function datumKeyVon(s: string): string {
  return dateKeyOf(fromDbTime(s));
}

/**
 * Pensum & Abwesenheiten einer Büroperson (Modul 8): wiederkehrende
 * Wochenplan-Blöcke, Tages-Abweichungen, Abwesenheiten und das anpassbare
 * Urlaubs-Jahreskontingent.
 */
export default async function BueroplanPersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { user: actor } = await requireStaff();
  if (!canManageBueroplan(actor.roles as Role[])) {
    redirect("/dashboard");
  }
  const { personId } = await params;
  const person = await ladeBueroperson(personId);
  if (!person) notFound();

  const [diensteRows, abweichungenRows, abwesenheitenRows, kontingenteRows] = await Promise.all([
    db.orm.public.BueroDienst.where({ personId }).all(),
    db.orm.public.BueroAbweichung.where({ personId }).all(),
    db.orm.public.BueroAbwesenheit.where({ personId }).all(),
    db.orm.public.BueroUrlaubskontingent.where({ personId }).all(),
  ]);

  const dienste: (DienstBlock & { id: string })[] = diensteRows.map((d) => ({
    id: d.id,
    wochentag: d.wochentag,
    startZeit: d.startZeit,
    endZeit: d.endZeit,
    notiz: d.notiz,
  }));
  const abweichungen = abweichungenRows
    .map((a) => ({
      id: a.id,
      datumKey: datumKeyVon(a.datum),
      art: a.art,
      startZeit: a.startZeit,
      endZeit: a.endZeit,
      notiz: a.notiz,
    }))
    .sort((a, b) => b.datumKey.localeCompare(a.datumKey)); // anstehende zuerst
  const abwesenheiten: (AbwesenheitBereich & { id: string })[] = abwesenheitenRows
    .map((a) => ({
      id: a.id,
      art: a.art,
      vonKey: datumKeyVon(a.von),
      bisKey: datumKeyVon(a.bis),
      bemerkung: a.bemerkung,
    }))
    .sort((a, b) => b.vonKey.localeCompare(a.vonKey));
  const kontingente = kontingenteRows.map((k) => ({ jahr: k.jahr, tage: k.tage })).sort((a, b) => a.jahr - b.jahr);

  const heute = heuteDateKey();
  const aktuellesJahr = Number(heute.slice(0, 4));
  const kontingentJahre = kontingente.some((k) => k.jahr === aktuellesJahr)
    ? kontingente.map((k) => k.jahr)
    : [...kontingente.map((k) => k.jahr), aktuellesJahr].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bueroplan" className="text-sm text-slate-500 transition hover:text-brand-700">
          ← Büroplan
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{person.name}</h1>
          <div className="flex flex-wrap gap-1">
            {person.rollen.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-slate-600">Konto: {person.kontoEmail}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Wochenplan (Pensum) */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">Wochenplan (Pensum)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Wiederkehrende Zeitblöcke — beliebig viele pro Tag (z.B. 45 Min vor und nach Unterricht).
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {[1, 2, 3, 4, 5, 6, 7].map((wt) => {
              const bloecke = diensteFuerWochentag(dienste, wt);
              return (
                <li key={wt} className="flex items-start justify-between gap-3 py-2">
                  <span className="w-24 shrink-0 font-medium text-slate-700">{WOCHENTAG_NAMEN[wt - 1]}</span>
                  <span className="min-w-0 flex-1">
                    {bloecke.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {bloecke.map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1.5 rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-line"
                            title={b.notiz ?? undefined}
                          >
                            {b.startZeit}–{b.endZeit}
                            <LoeschForm
                              action={deleteDienstAction}
                              fields={{ id: b.id }}
                              label="×"
                              confirmText={`Block ${b.startZeit}–${b.endZeit} (${WOCHENTAG_NAMEN[wt - 1]}) entfernen?`}
                            />
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <DienstForm personId={personId} />
          </div>
        </section>

        {/* Abweichungen */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">Tages-Abweichungen</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            An einzelnen Tagen abweichende Arbeitszeit (ersetzt das Pensum) oder dienstfrei.
          </p>
          {abweichungen.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Keine Abweichungen erfasst.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {abweichungen.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className={`font-medium ${a.datumKey < heute ? "text-slate-400" : "text-slate-800"}`}>
                      {formatDatum(a.datumKey)}
                    </span>
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      {BUERO_ABWEICHUNG_LABELS[a.art]}
                      {a.art === "ARBEITSZEIT" && a.startZeit && a.endZeit ? ` ${a.startZeit}–${a.endZeit}` : ""}
                    </span>
                    {a.notiz && <span className="ml-2 text-slate-500">{a.notiz}</span>}
                  </span>
                  <LoeschForm action={deleteAbweichungAction} fields={{ id: a.id }} label="×" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <AbweichungForm personId={personId} />
          </div>
        </section>

        {/* Abwesenheiten */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">Abwesenheiten</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Urlaub (zählt aufs Kontingent), Krankheit und sonstige Abwesenheiten — direkt eingetragen,
            ohne Genehmigungs-Workflow.
          </p>
          {abwesenheiten.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Keine Abwesenheiten erfasst.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {abwesenheiten.map((a) => {
                const tage = tageZwischen(a.vonKey, a.bisKey) + 1;
                const badgeStile: Record<string, string> = {
                  URLAUB: "bg-sky-100 text-sky-800",
                  KRANKHEIT: "bg-red-100 text-red-800",
                  SONSTIGE: "bg-violet-100 text-violet-800",
                };
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeStile[a.art]}`}>
                        {BUERO_ABWESENHEIT_LABELS[a.art]}
                      </span>
                      <span className={`ml-2 font-medium ${a.bisKey < heute ? "text-slate-400" : "text-slate-800"}`}>
                        {a.vonKey === a.bisKey ? formatDatum(a.vonKey) : `${formatDatum(a.vonKey)} – ${formatDatum(a.bisKey)}`}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {tage} Tag{tage === 1 ? "" : "e"}
                        {a.art === "URLAUB" ? " (Kontingent)" : ""}
                      </span>
                      {a.bemerkung && <span className="ml-2 text-slate-500">{a.bemerkung}</span>}
                    </span>
                    <LoeschForm
                      action={deleteAbwesenheitAction}
                      fields={{ id: a.id }}
                      label="×"
                      confirmText={`Abwesenheit ${formatDatum(a.vonKey)} – ${formatDatum(a.bisKey)} entfernen?`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3">
            <AbwesenheitForm personId={personId} />
          </div>
        </section>

        {/* Urlaubskontingent */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">Urlaubs-Kontingent</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Standard {BUERO_URLAUB_DEFAULT_TAGE} Tage pro Jahr — hier pro Jahr anpassbar. Kalendertage der
            Urlaub-Einträge, am Jahresrand anteilig.
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {kontingentJahre.map((jahr) => {
              const genutzt = urlaubstageImJahr(abwesenheiten, jahr);
              const kontingent = kontingentFuerJahr(kontingente, jahr);
              const rest = urlaubRest(genutzt, kontingent);
              const angepasst = kontingente.some((k) => k.jahr === jahr);
              return (
                <li key={jahr} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium text-slate-700">
                    {jahr}
                    {!angepasst && <span className="ml-2 text-xs text-slate-500">(Standard)</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-28 overflow-hidden rounded bg-slate-100">
                      <span
                        className={`block h-full ${rest < 0 ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, kontingent > 0 ? (genutzt / kontingent) * 100 : 0)}%` }}
                      />
                    </span>
                    <span className={`font-semibold ${rest < 0 ? "text-red-700" : "text-slate-800"}`}>
                      {genutzt} / {kontingent}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <KontingentForm personId={personId} />
          </div>
        </section>
      </div>
    </div>
  );
}
