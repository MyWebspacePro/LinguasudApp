import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewAuditLog, canViewPersonen, canViewUsers, hasRole } from "@/lib/auth/permissions";
import { RoleBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Übersicht",
};

/** Verwaltungs-Übersicht — wächst mit den kommenden Modulen. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  const [userCount, personCount, recentLogins] = await Promise.all([
    canViewUsers(roles)
      ? db.orm.public.User.aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewPersonen(roles)
      ? db.orm.public.Person.aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewAuditLog(roles)
      ? db.orm.public.AuditLog
          .where((e) => e.action.in(["user.login", "user.login_failed"]))
          .orderBy((e) => e.createdAt.desc())
          .limit(5)
          .all()
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Guten Tag, {user.firstName} {user.lastName}
        </h1>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canViewPersonen(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Personen-Kartei
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{personCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              <Link href="/personen" className="font-medium text-brand-700 hover:text-brand-800">
                Kartei öffnen
              </Link>
              {hasRole(roles, "ADMIN") || hasRole(roles, "BUERO") || hasRole(roles, "CHEF") ? (
                <>
                  {" · "}
                  <Link href="/personen/neu" className="font-medium text-brand-700 hover:text-brand-800">
                    Neue Person
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        )}

        {canViewUsers(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Konten</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{userCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              {hasRole(roles, "ADMIN") || hasRole(roles, "BUERO") ? (
                <>
                  <Link href="/benutzer/neu" className="font-medium text-brand-700 hover:text-brand-800">
                    Neues Konto anlegen
                  </Link>
                  {" · "}
                </>
              ) : null}
              <Link href="/benutzer" className="font-medium text-brand-700 hover:text-brand-800">
                Benutzerliste
              </Link>
            </p>
          </div>
        )}

        {canViewAuditLog(roles) && (
          <div className="card p-5 sm:col-span-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Letzte Anmelde-Ereignisse
            </p>
            {recentLogins && recentLogins.length > 0 ? (
              <ul className="mt-2 divide-y divide-line text-sm">
                {recentLogins.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-slate-700">{entry.summary}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {fromDbTime(entry.createdAt).toLocaleString("de-CH")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Noch keine Ereignisse.</p>
            )}
            <p className="mt-2 text-sm">
              <Link href="/audit" className="font-medium text-brand-700 hover:text-brand-800">
                Vollständiges Audit-Log →
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Nächste Ausbaustufen</h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <li>Modul 4–6 — Kurse, Anmeldungen, Lektionsplaner (Kern-Domäne)</li>
          <li>Modul 7 — Anwesenheitskontrolle</li>
          <li>Modul 8+ — Büroplanung, Rechnungen (QR), Honorare</li>
          <li>Modul 13+ — Aufgaben & Anfragen, KI-Generator, Website</li>
        </ul>
      </div>
    </div>
  );
}
