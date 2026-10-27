import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageKiEinstellungen, canViewKi } from "@/lib/auth/permissions";
import { ladeKiOptionen } from "@/lib/ki/daten";
import { getKiEinstellungen } from "@/lib/ki/einstellungen";
import { KiGeneratorForm } from "@/components/ki/KiGeneratorForm";

export const metadata: Metadata = {
  title: "KI-Lektor",
};

export default function KiGeneratorPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KiGeneratorContent />
    </Suspense>
  );
}

async function KiGeneratorContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewKi(roles)) redirect("/dashboard");

  const [optionen, einstellungen] = await Promise.all([ladeKiOptionen(), getKiEinstellungen()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">KI-Lektor</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Lektionspläne generieren, prüfen und in der Bibliothek ablegen — gespeicherte Lektionen
            lassen sich als PDF drucken und für das Kollegium freigeben.
          </p>
        </div>
        <Link href="/ki-generator/bibliothek" className="btn-secondary">
          Bibliothek öffnen
        </Link>
      </div>

      <KiGeneratorForm
        sprachen={optionen.sprachen.map((s) => ({ id: s.id, label: s.name }))}
        niveaus={optionen.niveaus.map((n) => ({ id: n.id, label: n.name ? `${n.code} — ${n.name}` : n.code }))}
        kursarten={optionen.kursarten.map((k) => ({ id: k.id, label: k.name }))}
        kiAktiv={einstellungen.aktiv}
        standardModell={einstellungen.modell}
        canManageEinstellungen={canManageKiEinstellungen(roles)}
      />

      <div className="text-xs text-slate-500">
        Tipp: Generierte Inhalte immer fachlich prüfen. Der API-Key liegt ausschliesslich auf dem
        Server; jede Generierung wird im Audit-Log vermerkt.
      </div>
    </div>
  );
}
