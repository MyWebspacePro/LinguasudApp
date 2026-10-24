import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewAuditLog } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Audit-Log",
};

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  "user.bootstrap": "System-Bootstrap",
  "user.login": "Anmeldung",
  "user.login_failed": "Anmeldung fehlgeschlagen",
  "user.logout": "Abmeldung",
  "user.create": "Konto angelegt",
  "user.update": "Konto geändert",
  "user.roles_change": "Rollen geändert",
  "user.password_change": "Passwort geändert",
  "user.password_reset_requested": "Reset angefordert",
  "user.password_reset_completed": "Reset durchgeführt",
  "user.password_set_by_admin": "Passwort gesetzt (Verwaltung)",
  "user.invite_sent": "Einladung/Link gesendet",
  "user.sessions_revoked": "Sitzungen beendet",
  "sprache.update": "Sprache geändert",
  "sprache.toggle": "Sprache aktiv/deaktiv",
  "sprache.archive": "Sprache archiviert",
  "sprache.delete": "Sprache gelöscht",
  "niveau.update": "Niveau geändert",
  "niveau.toggle": "Niveau aktiv/deaktiv",
  "niveau.archive": "Niveau archiviert",
  "niveau.delete": "Niveau gelöscht",
  "kursart.update": "Kursart geändert",
  "kursart.toggle": "Kursart aktiv/deaktiv",
  "kursart.archive": "Kursart archiviert",
  "kursart.delete": "Kursart gelöscht",
  "dauer.update": "Lektionsdauer geändert",
  "dauer.toggle": "Dauer aktiv/deaktiv",
  "dauer.archive": "Dauer archiviert",
  "dauer.delete": "Dauer gelöscht",
  "tarifstufe.update": "Tarifstufe geändert",
  "tarifstufe.delete": "Tarifstufe gelöscht",
  "preisliste.update": "Preisliste gespeichert",
  "kostentraeger.update": "Kostenträger geändert",
  "kostentraeger.toggle": "Kostenträger aktiv/deaktiv",
  "kostentraeger.archive": "Kostenträger archiviert",
  "kostentraeger.delete": "Kostenträger gelöscht",
  "standort.update": "Standort geändert",
  "standort.toggle": "Standort aktiv/deaktiv",
  "standort.archive": "Standort archiviert",
  "standort.delete": "Standort gelöscht",
  "etage.update": "Etage geändert",
  "etage.delete": "Etage gelöscht",
  "raum.update": "Raum geändert",
  "raum.toggle": "Raum aktiv/deaktiv",
  "raum.archive": "Raum archiviert",
  "raum.delete": "Raum gelöscht",
};

/** Audit-Log (Admin + Chef): alle wichtigen Änderungen, filterbar. */
export default function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AuditContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  if (!canViewAuditLog(actor.roles)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const action = typeof params.aktion === "string" && params.aktion ? params.aktion : null;
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(q && {
      OR: [
        { summary: { contains: q, mode: "insensitive" } },
        { actorEmail: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(action && { action }),
  };

  const [entries, total, actionCounts] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (seite: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (action) sp.set("aktion", action);
    if (seite > 1) sp.set("seite", String(seite));
    const qs = sp.toString();
    return qs ? `/audit?${qs}` : "/audit";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Audit-Log</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Nachvollziehbarkeit aller wichtigen Änderungen (wer, was, wann, von wo).
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-44 flex-1">
          <label htmlFor="audit-q" className="label">
            Suche (Zusammenfassung / Akteur)
          </label>
          <input id="audit-q" name="q" defaultValue={q} className="input" />
        </div>
        <div>
          <label htmlFor="audit-aktion" className="label">
            Aktion
          </label>
          <select id="audit-aktion" name="aktion" defaultValue={action ?? ""} className="input">
            <option value="">Alle</option>
            {actionCounts
              .sort((a, b) => a.action.localeCompare(b.action))
              .map((row) => (
                <option key={row.action} value={row.action}>
                  {ACTION_LABELS[row.action] ?? row.action} ({row._count._all})
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtern
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-180">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Zeit</th>
              <th className="th">Aktion</th>
              <th className="th">Akteur</th>
              <th className="th">Zusammenfassung</th>
              <th className="th">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="td whitespace-nowrap text-slate-600">
                  {entry.createdAt.toLocaleString("de-CH")}
                </td>
                <td className="td whitespace-nowrap">
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-800">
                    {entry.action}
                  </span>
                </td>
                <td className="td">
                  {entry.actorUserId ? (
                    <Link
                      href={`/benutzer/${entry.actorUserId}`}
                      className="text-brand-700 hover:text-brand-800"
                    >
                      {entry.actorEmail ?? entry.actorUserId}
                    </Link>
                  ) : (
                    <span className="text-slate-600">{entry.actorEmail ?? "System"}</span>
                  )}
                </td>
                <td className="td">{entry.summary}</td>
                <td className="td text-slate-600">{entry.ip ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={5}>
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} Einträge · Seite {page} von {pageCount}
        </span>
        {pageCount > 1 && (
          <span className="flex gap-3">
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
