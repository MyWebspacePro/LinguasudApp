import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewAnfragen } from "@/lib/auth/permissions";
import { dateKeyOf, formatDatum } from "@/lib/zeit";
import { AnfrageStatusBadge } from "@/components/anfragen/AnfragenBadges";

export const metadata: Metadata = {
  title: "Anfragen",
};

/**
 * Anfragen-Verwaltung (Modul 13): Eingänge vom öffentlichen Formular
 * (mit/ohne Einstufungstest) — Status, Zuordnung und Detail über die
 * Anfrage-Detailseite.
 */
export default function AnfragenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AnfragenContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AnfragenContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireStaff();
  if (!canViewAnfragen(user.roles as Role[])) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const statusFilter = ["OFFEN", "IN_BEARBEITUNG", "ZUGEORDNET", "ABGELEHNT"].includes(String(sp.status))
    ? String(sp.status)
    : "alle";

  const rows = await db.orm.public.Anfrage.orderBy((a) => a.createdAt.desc()).limit(200).all();
  const gefiltert = statusFilter === "alle" ? rows : rows.filter((a) => a.status === statusFilter);

  // Bezugsdaten per ID-Map.
  const [personRows, spracheRows, niveauRows] = await Promise.all([
    db.orm.public.Person.all(),
    db.orm.public.Sprache.all(),
    db.orm.public.Niveau.all(),
  ]);
  const personById = new Map(personRows.map((p) => [p.id, p]));
  const spracheById = new Map(spracheRows.map((s) => [s.id, s]));
  const niveauById = new Map(niveauRows.map((n) => [n.id, n]));

  const zaehler = {
    OFFEN: rows.filter((a) => a.status === "OFFEN").length,
    IN_BEARBEITUNG: rows.filter((a) => a.status === "IN_BEARBEITUNG").length,
    ZUGEORDNET: rows.filter((a) => a.status === "ZUGEORDNET").length,
    ABGELEHNT: rows.filter((a) => a.status === "ABGELEHNT").length,
  };

  const filterHref = (status: string) => (status === "alle" ? "/anfragen" : `/anfragen?status=${status}`);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Anfragen</h1>
          <p className="mt-1 text-sm text-slate-600">
            Eingänge über die Website ({zaehler.OFFEN} offen, {zaehler.IN_BEARBEITUNG} in Bearbeitung) —
            Zuordnung nach Identitätsprüfung.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/anfragen/neu" className="btn-primary">
            Anfrage erfassen
          </Link>
          <Link href="/anfrage" className="btn-secondary" target="_blank">
            Formular ansehen ↗
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ["alle", `Alle (${rows.length})`],
            ["OFFEN", `Offen (${zaehler.OFFEN})`],
            ["IN_BEARBEITUNG", `In Bearbeitung (${zaehler.IN_BEARBEITUNG})`],
            ["ZUGEORDNET", `Zugeordnet (${zaehler.ZUGEORDNET})`],
            ["ABGELEHNT", `Abgelehnt (${zaehler.ABGELEHNT})`],
          ] as const
        ).map(([wert, label]) => (
          <Link
            key={wert}
            href={filterHref(wert)}
            className={`rounded-full px-3 py-1 font-medium transition ${
              statusFilter === wert ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-800 hover:bg-brand-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {gefiltert.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          Keine Anfragen in dieser Ansicht. Neue Eingänge landen automatisch hier und als Aufgabe.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Eingang</th>
                <th className="th">Name</th>
                <th className="th">Kontakt</th>
                <th className="th">Sprache / Niveau</th>
                <th className="th">Test</th>
                <th className="th">Status</th>
                <th className="th">Person</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {gefiltert.map((a) => {
                const eingang = fromDbTime(a.createdAt);
                const sprache = a.spracheId ? spracheById.get(a.spracheId) : null;
                const niveau = a.niveauId ? niveauById.get(a.niveauId) : null;
                const empfohlen = a.empfohlenesNiveauId ? niveauById.get(a.empfohlenesNiveauId) : null;
                const person = a.personId ? personById.get(a.personId) : null;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="td whitespace-nowrap text-slate-500">{formatDatum(dateKeyOf(eingang))}</td>                    <td className="td">
                      <Link href={`/anfragen/${a.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {a.name}
                      </Link>
                    </td>
                    <td className="td">
                      <span className="block text-slate-600">{a.email}</span>
                      {a.telefon && <span className="block text-xs text-slate-500">{a.telefon}</span>}
                    </td>
                    <td className="td">
                      {sprache ? sprache.name : <span className="text-slate-400">—</span>}
                      {niveau && <span className="text-slate-500"> · {niveau.code}</span>}
                    </td>
                    <td className="td">
                      {empfohlen ? (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                          {empfohlen.code}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      <AnfrageStatusBadge status={a.status} />
                    </td>
                    <td className="td">
                      {person ? (
                        <Link href={`/personen/${person.id}`} className="text-xs text-brand-700 hover:text-brand-800">
                          {person.vorname} {person.nachname}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
