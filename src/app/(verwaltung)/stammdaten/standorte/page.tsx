import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageStammdaten, canViewStammdaten } from "@/lib/auth/permissions";
import { StandorteManager } from "@/components/stammdaten/StandorteManager";

export const metadata: Metadata = {
  title: "Standorte & Räume",
};

/** Standorte → Etagen → Räume (Hierarchie gilt später auch im Planer). */
export default function StandortePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <StandorteContent />
    </Suspense>
  );
}

async function StandorteContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewStammdaten(roles)) {
    redirect("/dashboard");
  }

  const standorte = await prisma.standort.findMany({
    orderBy: { name: "asc" },
    include: {
      etagen: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { raeume: { orderBy: { name: "asc" } } },
      },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Standorte & Räume</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Vorstadt 18 · Stadthausgasse 16 · Bahnhofplatz 9 — Räume mit Namen und Sitzplatzzahl.
        </p>
      </div>
      <StandorteManager
        standorte={standorte.map((s) => ({
          id: s.id,
          name: s.name,
          strasse: s.strasse,
          plz: s.plz,
          ort: s.ort,
          active: s.active,
          archived: Boolean(s.archivedAt),
          etagen: s.etagen.map((e) => ({
            id: e.id,
            name: e.name,
            sortOrder: e.sortOrder,
            raeume: e.raeume.map((r) => ({
              id: r.id,
              name: r.name,
              seats: r.seats,
              active: r.active,
              archived: Boolean(r.archivedAt),
            })),
          })),
        }))}
        canManage={canManageStammdaten(roles)}
      />
    </div>
  );
}
