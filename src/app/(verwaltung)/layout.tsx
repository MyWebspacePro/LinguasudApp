import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import {
  canManageBueroplan,
  canViewAnmeldungen,
  canViewAuditLog,
  canViewHonorare,
  canViewKurse,
  canViewPersonen,
  canViewPlaner,
  canViewStammdaten,
  canViewUsers,
  hasRole,
} from "@/lib/auth/permissions";
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
// Auth-lastige Route: bewusst klassisch blockierend statt Instant-Navigation
// (Session-Lookup kann nicht in den statischen Shell-Prerender).
export const instant = false;
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
  if (canViewPersonen(roles)) {
    navItems.push({ href: "/personen", label: "Personen" });
  }
  if (canViewKurse(roles)) {
    navItems.push({ href: "/kurse", label: "Kurse" });
  }
  if (canViewAnmeldungen(roles)) {
    navItems.push({ href: "/anmeldungen", label: "Anmeldungen" });
    navItems.push({ href: "/rechnungen", label: "Rechnungen" });
  }
  if (canViewHonorare(roles)) {
    navItems.push({ href: "/honorare", label: "Honorare" });
  }
  if (canViewPlaner(roles)) {
    navItems.push({ href: "/planer", label: "Raumplaner" });
  }
  if (canManageBueroplan(roles)) {
    navItems.push({ href: "/bueroplan", label: "Büroplan" });
  }
  if (canViewUsers(roles)) {
    navItems.push({ href: "/benutzer", label: "Benutzer" });
  }
  if (canViewStammdaten(roles)) {
    navItems.push({ href: "/stammdaten", label: "Stammdaten" });
  }
  if (canViewAuditLog(roles)) {
    navItems.push({ href: "/audit", label: "Audit-Log" });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex h-13 items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-sm font-semibold text-white">
              L
            </span>
            <span className="text-sm font-semibold text-slate-900">Linguasud Verwaltung</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/passwort-aendern"
              className="text-sm text-slate-600 transition hover:text-brand-700"
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

      <div className="flex flex-1">
        <aside className="sticky top-13 hidden h-[calc(100svh-3.25rem)] w-56 shrink-0 flex-col overflow-y-auto bg-brand-100 px-3 py-4 md:flex">
          <NavLinks items={navItems} />
          {hasRole(roles, "TEILNEHMER") && (
            <Link
              href="/portal"
              className="mt-3 block rounded-lg bg-white/60 px-3 py-1.5 text-sm font-medium text-brand-800 transition hover:bg-white"
            >
              Mein Portal →
            </Link>
          )}
          <div className="mt-auto space-y-1 pt-4">
            <p className="px-3 text-[11px] font-semibold tracking-wide text-brand-700/70 uppercase">
              Meine Rollen
            </p>
            <div className="flex flex-wrap gap-1 px-3 pt-1">
              {roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">
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
    <div className="flex min-h-svh flex-col" aria-hidden>
      <div className="border-b border-line">
        <div className="flex h-13 items-center px-4 md:px-6">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="flex flex-1">
        <div className="hidden w-56 shrink-0 bg-brand-100 md:block" />
        <div className="m-6 h-64 flex-1 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
