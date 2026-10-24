import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageStammdaten, canViewStammdaten } from "@/lib/auth/permissions";
import { TarifeManager } from "@/components/stammdaten/TarifeManager";

export const metadata: Metadata = {
  title: "Tarife & Preise",
};

/** Tarifstufen (Zeitfenster, Paketgrössen) + Preisliste Kursart × Dauer × Stufe. */
export default function TarifePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <TarifeContent />
    </Suspense>
  );
}

async function TarifeContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewStammdaten(roles)) {
    redirect("/dashboard");
  }

  const [tarifstufen, kursarten, dauern, preise] = await Promise.all([
    db.orm.public.Tarifstufe.orderBy((t) => t.name.asc()).all(),
    db.orm.public.Kursart
      .where((k) => k.archivedAt.isNull())
      .orderBy([(k) => k.sortOrder.asc(), (k) => k.name.asc()])
      .all(),
    db.orm.public.Lektionsdauer.where((d) => d.archivedAt.isNull()).orderBy((d) => d.minuten.asc()).all(),
    db.orm.public.Preis.all(),
  ]);

  const preisMap: Record<string, string> = {};
  for (const p of preise) {
    preisMap[`${p.kursartId}:${p.lektionsdauerId}:${p.tarifstufeId}`] = p.amountChf.toString();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tarife & Preise</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Tarifstufen legen die Paketgrösse (14/15 Lektionen) und die Zeitfenster fest; die
          Preisliste gilt je Kursart × Lektionsdauer × Tarifstufe.
        </p>
      </div>
      <TarifeManager
        tarifstufen={tarifstufen.map((t) => ({
          id: t.id,
          name: t.name,
          lessonsPerPackage: t.lessonsPerPackage,
          middayFrom: t.middayFrom,
          middayTo: t.middayTo,
          eveningFrom: t.eveningFrom,
        }))}
        kursarten={kursarten.map((k) => ({ id: k.id, name: k.name }))}
        dauern={dauern.map((d) => ({ id: d.id, minuten: d.minuten }))}
        preise={preisMap}
        canManage={canManageStammdaten(roles)}
      />
    </div>
  );
}
