import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { canViewAuditLog, canViewUsers, hasRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
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
  const [userCount, recentLogins] = await Promise.all([
    canViewUsers(roles) ? prisma.user.count() : Promise.resolve(null),
    canViewAuditLog(roles)
      ? prisma.auditLog.findMany({
          where: { action: { in: ["user.login", "user.login_failed"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
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
        {canViewUsers(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Konten</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{userCount}</p>
            <p className="mt-1 text-sm text-slate-500">
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
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Letzte Anmelde-Ereignisse
            </p>
            {recentLogins && recentLogins.length > 0 ? (
              <ul className="mt-2 divide-y divide-line text-sm">
                {recentLogins.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-slate-700">{entry.summary}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {entry.createdAt.toLocaleString("de-CH")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Noch keine Ereignisse.</p>
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
          <li>Modul 2 — Stammdaten (Standorte, Räume, Sprachen, Tarife)</li>
          <li>Modul 3 — Personenverwaltung (eine Kartei für alle)</li>
          <li>Modul 4–6 — Kurse, Anmeldungen, Lektionsplaner</li>
          <li>Modul 7+ — Anwesenheit, Rechnungen, Portal-Inhalte</li>
        </ul>
      </div>
    </div>
  );
}
