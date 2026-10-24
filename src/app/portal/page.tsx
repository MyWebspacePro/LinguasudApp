import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Mein Portal",
};

// Auth-lastige Route: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Kursteilnehmenden-Portal. Die Inhalte (nächste Lektionen + Raum, eigene
 * Rechnungen, Kursbestätigungen) entstehen mit den Modulen 4/6, 9 und 10 —
 * das Gerüst steht ab Modul 1.
 */
export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <PortalContent />
    </Suspense>
  );
}

async function PortalContent() {
  const { user } = await requireAuth();

  return (
    <div className="min-h-svh">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-sm font-semibold text-white">
              L
            </span>
            <span className="text-sm font-semibold text-slate-900">Mein Linguasud-Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/passwort-aendern"
              className="text-sm text-slate-600 transition hover:text-brand-700"
            >
              Passwort ändern
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="text-lg font-semibold text-slate-900">
          Hallo {user.firstName} {user.lastName}
        </h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800">Nächste Lektionen</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Ihre kommenden Lektionen mit Datum, Zeit und Raum erscheinen hier, sobald der
              Stundenplan eingerichtet ist.
            </p>
            <p className="mt-3 text-xs text-slate-500">Folgt mit Modul 4 &amp; 6 (Kurse &amp; Planer)</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800">Termine &amp; Änderungen</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Bei neuen Terminen oder Verschiebungen werden Sie hier und per E-Mail informiert.
            </p>
            <p className="mt-3 text-xs text-slate-500">Folgt mit Modul 6</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800">Meine Rechnungen</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Ihre Rechnungen können Sie hier einsehen und ausdrucken.
            </p>
            <p className="mt-3 text-xs text-slate-500">Folgt mit Modul 9 (QR-Rechnungen)</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-800">Kursbestätigungen</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Bestätigungen über abgeschlossene Niveau-Abschnitte stehen hier zum Selbstdrucken
              bereit.
            </p>
            <p className="mt-3 text-xs text-slate-500">Folgt mit Modul 10</p>
          </div>
        </div>
      </main>
    </div>
  );
}
