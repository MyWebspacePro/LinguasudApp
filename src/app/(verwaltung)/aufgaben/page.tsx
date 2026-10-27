import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime, AUFGABE_QUELLE_LABELS } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewAnfragen } from "@/lib/auth/permissions";
import { formatDatum, heuteDateKey } from "@/lib/zeit";
import { faelligkeitsSortKey, istAufgabeUeberfaellig } from "@/lib/aufgaben/logik";
import { AufgabeStatusBadge } from "@/components/anfragen/AnfragenBadges";

export const metadata: Metadata = {
  title: "Aufgaben",
};

/**
 * Aufgaben-System (Modul 13): schlichte Büro-Aufgabenliste mit Filter
 * (offen/erledigt/alle, meine) — Automatik-Aufgaben (Anfrage, Paket-Ende,
 * Anwesenheit) erscheinen mit Quelle-Badge.
 */
export default function AufgabenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AufgabenContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AufgabenContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireStaff();
  if (!canViewAnfragen(user.roles as Role[])) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const statusFilter = sp.status === "erledigt" ? "erledigt" : sp.status === "alle" ? "alle" : "offen";
  const nurMeine = sp.mine === "1";

  const rows = await db.orm.public.Aufgabe.all();

  const gefiltert = rows
    .filter((a) => {
      if (statusFilter === "offen" && a.status !== "OFFEN") return false;
      if (statusFilter === "erledigt" && a.status !== "ERLEDIGT") return false;
      if (nurMeine && a.assigneeUserId !== user.id) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status === "OFFEN" && b.status === "OFFEN") {
        const diff = faelligkeitsSortKey(a) - faelligkeitsSortKey(b);
        if (diff !== 0) return diff;
      }
      // Offene zuerst, danach erledigte absteigend nach Erledigung.
      if (a.status !== b.status) return a.status === "OFFEN" ? -1 : 1;
      return String(b.erledigtAt ?? "").localeCompare(String(a.erledigtAt ?? ""));
    })
    .slice(0, 200);

  // Bezugsdaten per ID-Map (Muster Vermietung).
  const [userRows, personRows, kursRows, anfrageRows] = await Promise.all([
    db.orm.public.User.all(),
    db.orm.public.Person.all(),
    db.orm.public.Kurs.all(),
    db.orm.public.Anfrage.all(),
  ]);
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const personById = new Map(personRows.map((p) => [p.id, p]));
  const kursById = new Map(kursRows.map((k) => [k.id, k]));
  const anfrageById = new Map(anfrageRows.map((a) => [a.id, a]));

  const heute = heuteDateKey();
  const offenCount = rows.filter((a) => a.status === "OFFEN").length;
  const meineOffenCount = rows.filter((a) => a.status === "OFFEN" && a.assigneeUserId === user.id).length;

  const filterHref = (status: string, mine: boolean) => {
    const params = new URLSearchParams();
    if (status !== "offen") params.set("status", status);
    if (mine) params.set("mine", "1");
    const q = params.toString();
    return q ? `/aufgaben?${q}` : "/aufgaben";
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Aufgaben</h1>
          <p className="mt-1 text-sm text-slate-600">
            {offenCount} offen, davon {meineOffenCount} mir zugewiesen · Automatik: neue Anfragen, Paket-Ende, offene Anwesenheiten
          </p>
        </div>
        <Link href="/aufgaben/neu" className="btn-primary">
          Neue Aufgabe
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ["offen", "Offen"],
            ["erledigt", "Erledigt"],
            ["alle", "Alle"],
          ] as const
        ).map(([wert, label]) => (
          <Link
            key={wert}
            href={filterHref(wert, nurMeine)}
            className={`rounded-full px-3 py-1 font-medium transition ${
              statusFilter === wert ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-800 hover:bg-brand-200"
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <Link
          href={filterHref(statusFilter, !nurMeine)}
          className={`rounded-full px-3 py-1 font-medium transition ${
            nurMeine ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-800 hover:bg-brand-200"
          }`}
        >
          Nur meine
        </Link>
      </div>

      {gefiltert.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          {statusFilter === "offen" ? "Keine offenen Aufgaben — alles erledigt." : "Keine Aufgaben in dieser Ansicht."}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Fällig</th>
                <th className="th">Aufgabe</th>
                <th className="th">Verknüpfung</th>
                <th className="th">Zugewiesen</th>
                <th className="th">Quelle</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {gefiltert.map((a) => {
                const faelligKey = a.faelligAm ? String(a.faelligAm).slice(0, 10) : null;
                const ueberfaellig = istAufgabeUeberfaellig({ status: a.status, faelligAm: faelligKey }, heute);
                const assignee = a.assigneeUserId ? userById.get(a.assigneeUserId) : null;
                const person = a.personId ? personById.get(a.personId) : null;
                const kurs = a.kursId ? kursById.get(a.kursId) : null;
                const anfrage = a.anfrageId ? anfrageById.get(a.anfrageId) : null;
                const erledigtAm = a.erledigtAt ? fromDbTime(a.erledigtAt) : null;
                return (
                  <tr key={a.id} className={a.status === "ERLEDIGT" ? "text-slate-400 hover:bg-slate-50/60" : "hover:bg-slate-50/60"}>
                    <td className="td whitespace-nowrap">
                      {faelligKey ? (
                        <span className={ueberfaellig ? "font-medium text-red-700" : ""}>
                          {formatDatum(faelligKey)}
                          {ueberfaellig && " · überfällig"}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      <Link href={`/aufgaben/${a.id}`} className={`font-medium ${a.status === "OFFEN" ? "text-brand-700 hover:text-brand-800" : ""}`}>
                        {a.titel}
                      </Link>
                      {erledigtAm && (
                        <span className="ml-2 text-xs">erledigt {erledigtAm.toLocaleDateString("de-CH")}</span>
                      )}
                    </td>
                    <td className="td">
                      {anfrage && (
                        <Link href={`/anfragen/${anfrage.id}`} className="text-xs text-brand-700 hover:text-brand-800">
                          Anfrage {anfrage.name}
                        </Link>
                      )}
                      {person && (
                        <Link href={`/personen/${person.id}`} className="text-xs text-brand-700 hover:text-brand-800">
                          {person.vorname} {person.nachname}
                        </Link>
                      )}
                      {kurs && (
                        <Link href={`/kurse/${kurs.id}`} className="text-xs text-brand-700 hover:text-brand-800">
                          {kurs.code}
                        </Link>
                      )}
                      {!anfrage && !person && !kurs && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="td">{assignee ? `${assignee.firstName} ${assignee.lastName}` : <span className="text-slate-400">unbeauftragt</span>}</td>
                    <td className="td">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {AUFGABE_QUELLE_LABELS[a.quelle] ?? a.quelle}
                      </span>
                    </td>
                    <td className="td">
                      <AufgabeStatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Aufgaben in der Detailansicht erledigen, wieder öffnen oder bearbeiten.
      </p>
    </div>
  );
}
