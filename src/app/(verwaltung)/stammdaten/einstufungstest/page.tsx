import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageStammdaten, canViewStammdaten } from "@/lib/auth/permissions";
import { EinstufungsfragenManager } from "@/components/stammdaten/EinstufungsfragenManager";

export const metadata: Metadata = {
  title: "Fragenkatalog Einstufungstest",
};

/**
 * Fragenkatalog des Online-Einstufungstests (Modul 13, Stammdaten — nur
 * Admin): Fragen je Sprache/Niveau mit 4 Antwortoptionen; inaktive Fragen
 * erscheinen nicht im öffentlichen Test.
 */
export default function EinstufungsfragenPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <EinstufungsfragenContent />
    </Suspense>
  );
}

async function EinstufungsfragenContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewStammdaten(roles)) redirect("/dashboard");

  const [fragen, sprachen, niveaus] = await Promise.all([
    db.orm.public.Einstufungsfrage.orderBy((f) => f.sortOrder.asc()).all(),
    db.orm.public.Sprache.orderBy((s) => s.name.asc()).all(),
    db.orm.public.Niveau.orderBy((n) => n.sortOrder.asc()).all(),
  ]);

  return (
    <EinstufungsfragenManager
      fragen={fragen.map((f) => ({
        id: f.id,
        spracheId: f.spracheId,
        niveauId: f.niveauId,
        text: f.text,
        antworten: [f.antwort1, f.antwort2, f.antwort3, f.antwort4],
        richtig: f.richtig,
        sortOrder: f.sortOrder,
        active: f.active,
      }))}
      sprachen={sprachen.map((s) => ({ id: s.id, label: s.name }))}
      niveaus={niveaus.map((n) => ({ id: n.id, label: n.code }))}
      canManage={canManageStammdaten(roles)}
    />
  );
}
