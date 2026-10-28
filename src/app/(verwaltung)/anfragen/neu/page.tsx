import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnfragen } from "@/lib/auth/permissions";
import { AnfrageErfassenForm } from "@/components/anfragen/AnfragenFormen";

export const metadata: Metadata = {
  title: "Anfrage erfassen",
};

/** Manuelle Anfrage-Erfassung (Modul 13): telefonische/persönliche Eingänge
 * durchs Büro — parallel zum öffentlichen Website-Formular. */
export default function NeueAnfragePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeueAnfrageContent />
    </Suspense>
  );
}

async function NeueAnfrageContent() {
  const { user } = await requireStaff();
  if (!canManageAnfragen(user.roles as Role[])) redirect("/dashboard");

  const [sprachen, niveaus] = await Promise.all([
    db.orm.public.Sprache.orderBy((s) => s.name.asc()).all(),
    db.orm.public.Niveau.orderBy((n) => n.sortOrder.asc()).all(),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/anfragen" className="text-sm text-brand-700 hover:text-brand-800">
          ← Anfragen
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Anfrage erfassen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manueller Eingang (z.B. Telefonat oder Schaltergespräch) — Bearbeitung und Zuordnung wie bei
          Website-Anfragen.
        </p>
      </div>
      <AnfrageErfassenForm
        sprachen={sprachen.map((s) => ({ id: s.id, label: s.name }))}
        niveaus={niveaus.map((n) => ({ id: n.id, label: n.name ? `${n.code} — ${n.name}` : n.code }))}
      />
    </div>
  );
}
