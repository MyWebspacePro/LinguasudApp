import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, fromDbTime, type Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageBueroplan } from "@/lib/auth/permissions";
import { RoleBadge } from "@/components/RoleBadge";
import { addDays, dateKeyOf, formatDatum, formatDatumKurz, heuteDateKey, parseDateKey, weekdayOfDateKey, WOCHENTAG_KURZ } from "@/lib/zeit";
import {
  BUERO_ABWESENHEIT_LABELS,
  kontingentFuerJahr,
  planDesTages,
  urlaubRest,
  urlaubstageImJahr,
  wochenStart,
  wochenTage,
  type AbwesenheitBereich,
  type DienstBlock,
  type TagesAbweichung,
} from "@/lib/bueroplan/logik";
import { ladeBueropersonen } from "@/lib/bueroplan/personen";

export const metadata: Metadata = {
  title: "Büroplan",
};

/** Reines Datumsfeld (UTC-Mitternacht) → Kalendertags-Key (Europe/Zurich). */
function datumKeyVon(s: string): string {
  return dateKeyOf(fromDbTime(s));
}

/** Büroplan (Modul 8): eigene Wochenansicht der Dienst- & Urlaubsplanung — bewusst nicht im Raumplaner. */
export default function BueroplanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <BueroplanContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BueroplanContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  if (!canManageBueroplan(actor.roles as Role[])) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const heute = heuteDateKey();
  const startRaw = typeof params.start === "string" && parseDateKey(params.start) ? params.start : heute;
  const montag = wochenStart(startRaw);
  const tage = wochenTage(montag);
  const anzeigeJahr = Number(tage[6]!.slice(0, 4));

  const [personen, diensteRows, abweichungenRows, abwesenheitenRows, kontingenteRows] = await Promise.all([
    ladeBueropersonen(),
    db.orm.public.BueroDienst.all(),
    db.orm.public.BueroAbweichung.all(),
    db.orm.public.BueroAbwesenheit.all(),
    db.orm.public.BueroUrlaubskontingent.all(),
  ]);

  const diensteProPerson = new Map<string, DienstBlock[]>();
  for (const d of diensteRows) {
    const liste = diensteProPerson.get(d.personId) ?? [];
    liste.push({ wochentag: d.wochentag, startZeit: d.startZeit, endZeit: d.endZeit, notiz: d.notiz });
    diensteProPerson.set(d.personId, liste);
  }

  const abweichungProPersonUndTag = new Map<string, Map<string, TagesAbweichung>>();
  for (const a of abweichungenRows) {
    const key = datumKeyVon(a.datum);
    if (key < tage[0]! || key > tage[6]!) continue;
    const proPerson = abweichungProPersonUndTag.get(a.personId) ?? new Map<string, TagesAbweichung>();
    proPerson.set(key, { art: a.art, startZeit: a.startZeit, endZeit: a.endZeit, notiz: a.notiz });
    abweichungProPersonUndTag.set(a.personId, proPerson);
  }

  const abwesenheitenProPerson = new Map<string, AbwesenheitBereich[]>();
  for (const a of abwesenheitenRows) {
    const liste = abwesenheitenProPerson.get(a.personId) ?? [];
    liste.push({ art: a.art, vonKey: datumKeyVon(a.von), bisKey: datumKeyVon(a.bis), bemerkung: a.bemerkung });
    abwesenheitenProPerson.set(a.personId, liste);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dienst- &amp; Urlaubsplanung Büro</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Wiederkehrende Pensen, Tages-Abweichungen und Abwesenheiten der Büropersonen — bewusst eine
            eigene Ansicht, unabhängig vom Raumplaner. Lehrpersonen organisieren sich selbst.
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm" aria-label="Wochen-Navigation">
          <Link href={`/bueroplan?start=${addDays(montag, -7)}`} className="btn-secondary px-3 py-1.5" aria-label="Vorherige Woche">
            ‹
          </Link>
          <Link href="/bueroplan" className="btn-secondary px-3 py-1.5">
            Diese Woche
          </Link>
          <Link href={`/bueroplan?start=${addDays(montag, 7)}`} className="btn-secondary px-3 py-1.5" aria-label="Nächste Woche">
            ›
          </Link>
        </nav>
      </div>

      <p className="text-sm font-medium text-slate-700">
        {formatDatum(tage[0]!)} – {formatDatum(tage[6]!)} · Urlaubs-Jahr {anzeigeJahr}
      </p>

      {personen.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          Noch keine Büropersonen erfasst. Die Ansicht zeigt alle Personen mit einem Konto der Rolle
          Büro, Admin oder Chef (Verknüpfung über die Personen-Kartei).
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-700">Person</th>
                {tage.map((t) => (
                  <th
                    key={t}
                    className={`px-2 py-2.5 text-center font-semibold ${
                      t === heute ? "bg-sky-50 text-sky-900" : "text-slate-700"
                    }`}
                  >
                    {WOCHENTAG_KURZ[weekdayOfDateKey(t) - 1]}
                    <span className="block text-xs font-normal text-slate-500">{formatDatumKurz(t).split(", ")[1]}</span>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold text-slate-700">Urlaub {anzeigeJahr}</th>
              </tr>
            </thead>
            <tbody>
              {personen.map((p) => {
                const dienste = diensteProPerson.get(p.personId) ?? [];
                const abweichungen = abweichungProPersonUndTag.get(p.personId);
                const abwesenheiten = abwesenheitenProPerson.get(p.personId) ?? [];
                const genutzt = urlaubstageImJahr(abwesenheiten, anzeigeJahr);
                const kontingent = kontingentFuerJahr(
                  kontingenteRows.filter((k) => k.personId === p.personId),
                  anzeigeJahr,
                );
                const rest = urlaubRest(genutzt, kontingent);
                return (
                  <tr key={p.personId} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/bueroplan/${p.personId}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.rollen.map((r) => (
                          <RoleBadge key={r} role={r} />
                        ))}
                      </div>
                      <Link href={`/bueroplan/${p.personId}`} className="mt-1 inline-block text-xs text-slate-500 hover:text-brand-700">
                        Pensum &amp; Abwesenheiten →
                      </Link>
                    </td>
                    {tage.map((t) => {
                      const plan = planDesTages(t, dienste, abweichungen?.get(t) ?? null, abwesenheiten);
                      return (
                        <td key={t} className={`px-2 py-3 text-center text-xs ${t === heute ? "bg-sky-50/60" : ""}`}>
                          <TagesZelle plan={plan} />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${rest < 0 ? "text-red-700" : "text-slate-800"}`}>
                        {genutzt} / {kontingent}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {rest >= 0 ? `${rest} Tage offen` : `${-rest} Tage überzogen`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded bg-sky-100 px-2 py-0.5 font-medium text-sky-800">Urlaub</span>
        <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">Krankheit</span>
        <span className="rounded bg-violet-100 px-2 py-0.5 font-medium text-violet-800">
          {BUERO_ABWESENHEIT_LABELS.SONSTIGE}
        </span>
        <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">abweichende Arbeitszeit</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">dienstfrei</span>
      </div>
    </div>
  );
}

/** Zellen-Inhalt der Wochenansicht: Blöcke, Abwesenheits-Badge oder dienstfrei. */
function TagesZelle({ plan }: { plan: ReturnType<typeof planDesTages> }) {
  if (plan.abwesenheit) {
    const stile: Record<string, string> = {
      URLAUB: "bg-sky-100 text-sky-800",
      KRANKHEIT: "bg-red-100 text-red-800",
      SONSTIGE: "bg-violet-100 text-violet-800",
    };
    return (
      <span className={`inline-block rounded px-2 py-0.5 font-medium ${stile[plan.abwesenheit]}`}>
        {BUERO_ABWESENHEIT_LABELS[plan.abwesenheit]}
      </span>
    );
  }
  if (plan.dienstfrei) {
    return <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">dienstfrei</span>;
  }
  if (plan.bloecke.length === 0) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <div className="space-y-1">
      {plan.bloecke.map((b, i) => (
        <div
          key={i}
          className={
            b.quelle === "ABWEICHUNG"
              ? "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900"
              : "rounded bg-slate-50 px-1.5 py-0.5 text-slate-700"
          }
          title={b.notiz ?? undefined}
        >
          {b.startZeit}–{b.endZeit}
        </div>
      ))}
    </div>
  );
}
