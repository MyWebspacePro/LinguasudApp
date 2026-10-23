import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import {
  ALL_ROLES,
  BUERO_ASSIGNABLE_ROLES,
  canEditUser,
  canViewUsers,
  hasRole,
} from "@/lib/auth/permissions";
import { getEnv, isMailConfigured } from "@/lib/env";
import { RoleBadge } from "@/components/RoleBadge";
import { UserEditForm } from "@/components/users/UserEditForm";
import { UserPasswordPanel } from "@/components/users/UserPasswordPanel";
import { UserActiveToggle, UserSessionsRevoke } from "@/components/users/UserAdminActions";

export const metadata: Metadata = {
  title: "Benutzerdetail",
};

/** Konto-Detail: Stammdaten, Rollen, Passwort, Status, Sitzungen, Audit-Spur. */
export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <UserDetailContent params={params} />
    </Suspense>
  );
}

async function UserDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: actor } = await requireStaff();
  const actorRoles = actor.roles as Role[];
  if (!canViewUsers(actorRoles)) {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true } } },
  });
  if (!user) {
    notFound();
  }

  const targetRoles = user.roles as Role[];
  const editable = canEditUser(actorRoles, targetRoles);
  const assignable = hasRole(actorRoles, "ADMIN")
    ? ALL_ROLES
    : hasRole(actorRoles, "BUERO")
      ? [...BUERO_ASSIGNABLE_ROLES]
      : [];
  const env = getEnv();
  const emailInviteAvailable = isMailConfigured(env) || env.APP_ENV === "development";

  const auditEntries = await prisma.auditLog.findMany({
    where: { OR: [{ entity: "user", entityId: user.id }, { actorUserId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const activeSessions = await prisma.session.count({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/benutzer" className="text-sm text-slate-500 hover:text-brand-700">
          ← Benutzerliste
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">
            {user.firstName} {user.lastName}
          </h1>
          {targetRoles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
          {!user.isActive && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-slate-500">
              deaktiviert
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Stammdaten & Rollen</h2>
          {editable ? (
            <UserEditForm
              user={{
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                roles: targetRoles,
              }}
              assignableRoles={assignable}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <Row label="Vorname">{user.firstName}</Row>
              <Row label="Nachname">{user.lastName}</Row>
              <Row label="E-Mail">{user.email}</Row>
              <Row label="Rollen">
                <span className="flex flex-wrap gap-1">
                  {targetRoles.map((role) => (
                    <RoleBadge key={role} role={role} />
                  ))}
                </span>
              </Row>
              <Row label="Letzte Anmeldung">
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString("de-CH") : "—"}
              </Row>
              <Row label="Erstellt">{user.createdAt.toLocaleDateString("de-CH")}</Row>
              {actor.id === user.id && (
                <p className="pt-1 text-xs text-slate-400">
                  Eigene Rollenänderungen und Deaktivierung sind eingeschränkt (mindestens eine
                  aktive Admin-Person muss bleiben).
                </p>
              )}
            </dl>
          )}
        </section>

        <div className="space-y-4">
          {editable && (
            <>
              <section className="card p-5">
                <h2 className="mb-1 text-sm font-semibold text-slate-800">Passwort</h2>
                <p className="mb-4 text-xs text-slate-500">
                  {user.passwordHash
                    ? "Zurücksetzen oder Link senden."
                    : "Noch kein Passwort gesetzt — Link senden oder direkt setzen."}
                </p>
                <UserPasswordPanel userId={user.id} emailInviteAvailable={emailInviteAvailable} />
              </section>

              <section className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Status</h2>
                <UserActiveToggle userId={user.id} isActive={user.isActive} />
              </section>

              <section className="card p-5">
                <h2 className="mb-1 text-sm font-semibold text-slate-800">Sitzungen</h2>
                <p className="mb-3 text-xs text-slate-500">
                  {activeSessions === 0
                    ? "Keine laufenden Sitzungen."
                    : `${activeSessions} laufende Sitzung${activeSessions === 1 ? "" : "en"}.`}
                </p>
                <UserSessionsRevoke userId={user.id} />
              </section>
            </>
          )}

          {!editable && hasRole(actorRoles, "CHEF") && (
            <div className="alert-info">
              Lesende Ansicht: Rollen vergibt ausschliesslich der Admin (Pflichtenheft).
            </div>
          )}
        </div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-slate-800">
          Audit-Spur (letzte 15)
        </h2>
        <table className="w-full min-w-140">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Zeit</th>
              <th className="th">Aktion</th>
              <th className="th">Zusammenfassung</th>
              <th className="th">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {auditEntries.map((entry) => (
              <tr key={entry.id}>
                <td className="td whitespace-nowrap text-slate-500">
                  {entry.createdAt.toLocaleString("de-CH")}
                </td>
                <td className="td font-mono text-xs text-slate-600">{entry.action}</td>
                <td className="td">{entry.summary}</td>
                <td className="td text-slate-500">{entry.ip ?? "—"}</td>
              </tr>
            ))}
            {auditEntries.length === 0 && (
              <tr>
                <td className="td py-6 text-center text-slate-500" colSpan={4}>
                  Keine Einträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-800">{children}</dd>
    </div>
  );
}
