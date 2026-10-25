import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { KursStatus, Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageKurse, canViewKurse, hasRole } from "@/lib/auth/permissions";
import { KURS_STATUS_LABELS, KURS_STATUS_WERTE } from "@/lib/domain";
import { WOCHENTAG_KURZ } from "@/lib/zeit";
import { KursStatusBadge } from "@/components/kurse/KursAktionen";

export const metadata: Metadata = {
  title: "Kurse",
};

const PAGE_SIZE = 20;

/** Kursliste (Modul 4): fortlaufende Kurse — Büro sieht alle, Lehrpersonen ihre eigenen. */
export default function KursePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KurseContent searchParams={searchParams} />
    </Suspense>
  );
}

async function KurseContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewKurse(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManageKurse(roles);
  const eigeneLehrpersonId = !canManage && hasRole(roles, "LEHRPERSON") ? actor.personId : null;

  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = KURS_STATUS_WERTE.includes(params.status as KursStatus) ? (params.status as KursStatus) : null;
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);

  let scoped = q
    ? db.orm.public.Kurs.where((k) => k.code.ilike(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`))
    : db.orm.public.Kurs;
  if (status) scoped = scoped.where({ status });
  if (eigeneLehrpersonId) scoped = scoped.where({ lehrpersonId: eigeneLehrpersonId });

  const [kurse, total] = await Promise.all([
    scoped
      .orderBy((k) => k.code.asc())
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .include("sprache")
      .include("niveau")
      .include("kursart")
      .include("lehrperson")
      .include("standardRaum")
      .all(),
    scoped.aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (seite: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (seite > 1) sp.set("seite", String(seite));
    const qs = sp.toString();
    return qs ? `/kurse?${qs}` : "/kurse";
  };

  const terminLabel = (k: (typeof kurse)[number]) =>
    k.wochentag && k.startZeit && k.dauerMinuten
      ? `${WOCHENTAG_KURZ[k.wochentag - 1]} ${k.startZeit} · ${k.dauerMinuten}′`
      : "ohne Fixtermin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Kurse</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Fortlaufende Kurse ohne Start-/Enddatum — Teilnehmende buchen Pakete und verlängern.
          </p>
        </div>
        {canManage && (
          <Link href="/kurse/neu" className="btn-primary">
            Neuer Kurs
          </Link>
        )}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-52 flex-1">
          <label htmlFor="filter-q" className="label">
            Kurscode
          </label>
          <input id="filter-q" name="q" defaultValue={q} placeholder="z.B. DE-B2 …" className="input" />
        </div>
        <div>
          <label htmlFor="filter-status" className="label">
            Status
          </label>
          <select id="filter-status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Alle</option>
            {KURS_STATUS_WERTE.map((s) => (
              <option key={s} value={s}>
                {KURS_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtern
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-200">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Kurscode</th>
              <th className="th">Status</th>
              <th className="th">Sprache · Niveau</th>
              <th className="th">Kursart</th>
              <th className="th">Lehrperson</th>
              <th className="th">Termin</th>
              <th className="th">Ort</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {kurse.map((k) => {
              const istPausiertOderBeendet = k.status !== "GEPLANT" && k.status !== "AKTIV";
              return (
                <tr key={k.id} className={istPausiertOderBeendet ? "text-slate-500" : ""}>
                  <td className="td font-mono text-sm font-semibold">{k.code}</td>
                  <td className="td">
                    <KursStatusBadge status={k.status} />
                  </td>
                  <td className="td">
                    {k.sprache.name} · <span className="font-semibold">{k.niveau.code}</span>
                  </td>
                  <td className="td">{k.kursart.name}</td>
                  <td className="td">
                    {k.lehrperson
                      ? `${k.lehrperson.vorname} ${k.lehrperson.nachname}`
                      : <span className="text-slate-400">offen</span>}
                  </td>
                  <td className="td whitespace-nowrap">{terminLabel(k)}</td>
                  <td className="td">
                    {k.extern
                      ? <span className="text-xs font-semibold text-slate-600">extern: {k.externOrt ?? "—"}</span>
                      : k.standardRaum
                        ? <span className="text-xs text-slate-600">{k.standardRaum.name}</span>
                        : <span className="text-xs text-slate-500">ohne Raum</span>}
                  </td>
                  <td className="td text-right">
                    <Link href={`/kurse/${k.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                      Öffnen
                    </Link>
                  </td>
                </tr>
              );
            })}
            {kurse.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={8}>
                  {eigeneLehrpersonId
                    ? "Ihnen sind noch keine Kurse zugewiesen."
                    : "Noch keine Kurse erfasst."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} Kurs{total === 1 ? "" : "e"} · Seite {page} von {pageCount}
        </span>
        {pageCount > 1 && (
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="font-medium text-brand-700">
                ← Zurück
              </Link>
            )}
            {page < pageCount && (
              <Link href={pageHref(page + 1)} className="font-medium text-brand-700">
                Weiter →
              </Link>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
