import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageStammdaten, canViewStammdaten } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Stammdaten",
};

const AREAS = [
  { href: "/stammdaten/standorte", label: "Standorte & Räume", desc: "Hierarchie Standort → Etage → Raum, Sitzplätze" },
  { href: "/stammdaten/sprachen", label: "Sprachen", desc: "Unterrichtete Sprachen mit Kürzeln" },
  { href: "/stammdaten/niveaus", label: "Niveaus", desc: "A1 … C2, Sortierung frei" },
  { href: "/stammdaten/kursarten", label: "Kursarten", desc: "Einzel … Firmenkurs, beliebig erweiterbar" },
  { href: "/stammdaten/dauern", label: "Lektionsdauern", desc: "45/60/90 Minuten …" },
  { href: "/stammdaten/tarife", label: "Tarife & Preise", desc: "Tarifstufen (Zeitfenster) + Preisliste" },
  { href: "/stammdaten/kostentraeger", label: "Kostenträger", desc: "Firmen + öffentliche Einrichtungen" },
] as const;

/** Stammdaten-Übersicht (Modul 2): pflegt nur Admin, Chef sieht lesend. */
export default function StammdatenPage() {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <StammdatenContent />
    </Suspense>
  );
}

async function StammdatenContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewStammdaten(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManageStammdaten(roles);

  const [standorte, raeume, sprachen, niveaus, kursarten, dauern, preise, kostentraeger] =
    await Promise.all([
      prisma.standort.count(),
      prisma.raum.count(),
      prisma.sprache.count(),
      prisma.niveau.count(),
      prisma.kursart.count(),
      prisma.lektionsdauer.count(),
      prisma.preis.count(),
      prisma.kostentraeger.count(),
    ]);

  const counts: Record<string, number> = {
    "/stammdaten/standorte": raeume > 0 ? raeume : standorte,
    "/stammdaten/sprachen": sprachen,
    "/stammdaten/niveaus": niveaus,
    "/stammdaten/kursarten": kursarten,
    "/stammdaten/dauern": dauern,
    "/stammdaten/tarife": preise,
    "/stammdaten/kostentraeger": kostentraeger,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Stammdaten</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Grundlagen für Kurse, Anmeldungen und Rechnungen{canManage ? "" : " — lesend (pflegt nur die Verwaltung)"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AREAS.map((area) => (
          <Link key={area.href} href={area.href} className="card p-5 transition hover:border-brand-300 hover:shadow">
            <p className="text-sm font-semibold text-slate-900">{area.label}</p>
            <p className="mt-1 text-2xl font-semibold text-brand-700">{counts[area.href] ?? 0}</p>
            <p className="mt-1 text-xs text-slate-600">{area.desc}</p>
          </Link>
        ))}
      </div>

      <div className="alert-info">
        Regel: alles anlegen · aktivieren/deaktivieren · löschen nur wenn unbenutzt · archivieren.
        Änderungen werden im Audit-Log festgehalten.
      </div>
    </div>
  );
}
