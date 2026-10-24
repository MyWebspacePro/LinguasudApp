import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { or } from "@prisma/orm-postgres/orm-client";
import type { PersonStatus, Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManagePersonen, canViewPersonen } from "@/lib/auth/permissions";
import { ANREDE_LABELS, PERSON_STATUS_LABELS, PERSON_STATUS_WERTE } from "@/lib/domain";
import { KuerzelBadge, PersonStatusBadge } from "@/components/personen/PersonBadges";

export const metadata: Metadata = {
  title: "Personen",
};

const PAGE_SIZE = 20;

/** Personen-Kartei (Modul 3): eine Kartei für alle — Admin/Chef/Büro. */
export default function PersonenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <PersonenContent searchParams={searchParams} />
    </Suspense>
  );
}

/** LIKE-Teiltreffer ohne Gross-/Kleinschreibung; Wildcards im Suchbegriff werden escapt. */
function containsIL(value: string): string {
  return `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function PersonenContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewPersonen(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManagePersonen(roles);

  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = PERSON_STATUS_WERTE.includes(params.status as PersonStatus)
    ? (params.status as PersonStatus)
    : null;
  const lehrkraft = params.lehrkraft === "ja" || params.lehrkraft === "nein" ? params.lehrkraft : null;
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);

  let scoped = q
    ? db.orm.public.Person.where((p) =>
        or(p.vorname.ilike(containsIL(q)), p.nachname.ilike(containsIL(q)), p.email.ilike(containsIL(q))),
      )
    : db.orm.public.Person;
  if (status) scoped = scoped.where({ status });
  if (lehrkraft === "ja") scoped = scoped.where({ istLehrperson: true });
  if (lehrkraft === "nein") scoped = scoped.where({ istLehrperson: false });

  const [personen, total] = await Promise.all([
    scoped
      .orderBy([(p) => p.nachname.asc(), (p) => p.vorname.asc()])
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .all(),
    scoped.aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (seite: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (lehrkraft) sp.set("lehrkraft", lehrkraft);
    if (seite > 1) sp.set("seite", String(seite));
    const qs = sp.toString();
    return qs ? `/personen?${qs}` : "/personen";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Personen</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Eine Kartei für alle — Interessent/innen, Teilnehmende, Kinder, Lehrpersonen.
          </p>
        </div>
        {canManage && (
          <Link href="/personen/neu" className="btn-primary">
            Neue Person
          </Link>
        )}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-44 flex-1">
          <label htmlFor="filter-q" className="label">
            Suche
          </label>
          <input id="filter-q" name="q" defaultValue={q} placeholder="Name oder E-Mail …" className="input" />
        </div>
        <div>
          <label htmlFor="filter-status" className="label">
            Status
          </label>
          <select id="filter-status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Alle</option>
            {PERSON_STATUS_WERTE.map((s) => (
              <option key={s} value={s}>
                {PERSON_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-lehrkraft" className="label">
            Lehrperson
          </label>
          <select id="filter-lehrkraft" name="lehrkraft" defaultValue={lehrkraft ?? ""} className="input">
            <option value="">Alle</option>
            <option value="ja">Nur Lehrpersonen</option>
            <option value="nein">Ohne Lehrpersonen</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtern
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-160">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Name</th>
              <th className="th">Status</th>
              <th className="th">E-Mail</th>
              <th className="th">Telefon 1</th>
              <th className="th">Kürzel</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {personen.map((p) => (
              <tr key={p.id} className={p.status === "INAKTIV" ? "text-slate-500" : ""}>
                <td className="td font-medium">
                  {ANREDE_LABELS[p.anrede]} {p.vorname} {p.nachname}
                  {p.istLehrperson && (
                    <span className="ml-1.5 text-xs font-normal text-emerald-700">Lehrperson</span>
                  )}
                </td>
                <td className="td">
                  <PersonStatusBadge status={p.status} />
                </td>
                <td className="td">{p.email ?? "—"}</td>
                <td className="td">
                  <TelefonCell nummer={p.telefon1} whatsapp={p.whatsapp1} signal={p.signal1} />
                </td>
                <td className="td">{p.istLehrperson && p.kuerzel ? <KuerzelBadge kuerzel={p.kuerzel} /> : "—"}</td>
                <td className="td text-right">
                  <Link href={`/personen/${p.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                    Öffnen
                  </Link>
                </td>
              </tr>
            ))}
            {personen.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={6}>
                  Keine Personen gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} Person{total === 1 ? "" : "en"} · Seite {page} von {pageCount}
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

/** Telefonnummer mit WhatsApp-/Signal-Markierung. */
function TelefonCell({
  nummer,
  whatsapp,
  signal,
}: {
  nummer: string | null;
  whatsapp: boolean;
  signal: boolean;
}) {
  if (!nummer && !whatsapp && !signal) return <span className="text-slate-400">—</span>;
  return (
    <span className="whitespace-nowrap">
      {nummer ?? "—"}
      {whatsapp && (
        <span
          className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700"
          title="nutzt WhatsApp"
        >
          WA
        </span>
      )}
      {signal && (
        <span
          className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-700"
          title="nutzt Signal"
        >
          SI
        </span>
      )}
    </span>
  );
}
