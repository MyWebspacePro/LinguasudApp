import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageKurse } from "@/lib/auth/permissions";
import { loadKursOptionen } from "@/lib/kurse/optionen";
import { KursForm } from "@/components/kurse/KursForm";

export const metadata: Metadata = {
  title: "Neuer Kurs",
};

/** Kurs anlegen (Modul 4): nur Büro. */
export default function NeuerKursPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeuerKursContent />
    </Suspense>
  );
}

async function NeuerKursContent() {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canManageKurse(roles)) {
    redirect("/kurse");
  }
  const optionen = await loadKursOptionen();

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/kurse" className="text-sm text-brand-700 hover:text-brand-800">
          ← Kurse
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Neuer Kurs</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Der Kurscode wird automatisch vergeben (Sprache-Niveau-Kursart-Lehrkürzel-Serial).
        </p>
      </div>

      <div className="card p-5">
        <KursForm optionen={optionen} />
      </div>
    </div>
  );
}
