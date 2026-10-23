import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { canViewAuditLog, canViewUsers, hasRole } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { RoleBadge } from "@/components/RoleBadge";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Layout des Verwaltungsbereichs: authentifiziert + Stabsrolle (alles ausser
 * reinen Kursteilnehmenden). Der Session-Lookup liegt hinter einer Suspense-
 * Grenze (Cache Components / PPR): das Grundgerüst erscheint sofort, die
 * nutzungsspezifische Schale streamt danach.
 */
export default function VerwaltungLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <VerwaltungGate>{children}</VerwaltungGate>
    </Suspense>
  );
}

async function VerwaltungGate({ children }: { children: ReactNode }) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];

  const navItems: NavItem[] = [{ href: "/dashboard", label: "Übersicht" }];
  if (canViewUsers(roles)) {
    navItems.push({ href: "/benutzer", label: "Benutzer" });
  }
  if (canViewAuditLog(roles)) {
    navItems.push({ href: "/audit", label: "Audit-Log" });
  }

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-sm font-semibold text-white">
              L
            </span>
            <span className="text-sm font-semibold text-slate-900">Linguasud Verwaltung</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/passwort-aendern"
              className="text-sm text-slate-500 transition hover:text-brand-700"
            >
              Passwort ändern
            </Link>
            <span className="hidden text-sm text-slate-600 sm:inline" title={user.email}>
              {user.firstName} {user.lastName}
            </span>
            <form action={logoutAction}>
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">
                Abmelden
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-5">
        <aside className="hidden w-44 shrink-0 md:block">
          <NavLinks items={navItems} />
          {hasRole(roles, "TEILNEHMER") && (
            <Link
              href="/portal"
              className="mt-3 block rounded-md border border-line px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-800"
            >
              Mein Portal →
            </Link>
          )}
          <div className="mt-5 space-y-1 border-t border-line pt-4">
            <p className="px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Meine Rollen
            </p>
            <div className="flex flex-wrap gap-1 px-3 pt-1">
              {roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Mobile-Navigation */}
          <div className="mb-4 md:hidden">
            <NavLinks items={navItems} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-svh" aria-hidden>
      <div className="border-b border-line">
        <div className="mx-auto flex h-13 max-w-6xl items-center px-4">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
