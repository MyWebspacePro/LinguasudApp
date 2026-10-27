import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { landingRoute } from "@/lib/auth/permissions";
import { roleList } from "@/lib/db";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";

export const metadata: Metadata = {
  title: "Sprachschule linguasud",
};

// Session-abhängig: Verwaltung wird weitergeleitet, anonyme Besucher sehen
// den Platzhalter mit dem öffentlichen Angebot (Einstufungstest, Anfrage).
// Bewusst blockierend statt Instant-Navigation (Session-Lookup).
export const instant = false;

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeRouter />
    </Suspense>
  );
}

async function HomeRouter() {
  const ctx = await getAuthContext();
  if (ctx) {
    if (ctx.user.mustChangePassword) {
      redirect("/passwort-aendern");
    }
    redirect(landingRoute(roleList(ctx.user.roles)));
    // redirect() wirft — dieser Punkt wird nie erreicht, TypeScript braucht ihn aber.
    return null;
  }
  return <Platzhalter />;
}

/**
 * Platzhalter-Startseite bis zur öffentlichen Website (Modul 15): verlinkt
 * die öffentlichen Angebote von Modul 13 und den Verwaltungs-Login.
 */
function Platzhalter() {
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Sprachschule linguasud"
          untertitel="Sprachen lernen in Schaffhausen und Winterthur."
        />
        <div className="space-y-3">
          <Link
            href="/einstufungstest"
            className="card block p-5 transition hover:bg-brand-50/60"
          >
            <p className="text-sm font-semibold text-slate-900">Einstufungstest</p>
            <p className="mt-1 text-sm text-slate-600">
              Finden Sie in wenigen Minuten Ihr Einstiegsniveau — mit automatischer Empfehlung.
            </p>
          </Link>
          <Link href="/anfrage" className="card block p-5 transition hover:bg-brand-50/60">
            <p className="text-sm font-semibold text-slate-900">Anfrage stellen</p>
            <p className="mt-1 text-sm text-slate-600">
              Erzählen Sie uns, was Sie lernen möchten — wir melden uns mit einem Kursvorschlag.
            </p>
          </Link>
          <Link href="/login" className="card block p-5 transition hover:bg-brand-50/60">
            <p className="text-sm font-semibold text-slate-900">Verwaltung</p>
            <p className="mt-1 text-sm text-slate-600">
              Zugang für das Team der Sprachschule (Login erforderlich).
            </p>
          </Link>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">
          Die vollständige Website entsteht mit einer späteren Ausbaustufe.
        </p>
      </div>
    </main>
  );
}
