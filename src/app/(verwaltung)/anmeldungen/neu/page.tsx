import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { loadAnmeldungOptionen } from "@/lib/anmeldungen/optionen";
import { AnmeldungForm } from "@/components/anmeldungen/AnmeldungForm";

export const metadata: Metadata = {
  title: "Neue Anmeldung",
};

/** Anmeldung erfassen (Modul 5): nur Büro. Optional mit Kurs-Vorwahl (?kurs=). */
export default function NeueAnmeldungPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeueAnmeldungContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NeueAnmeldungContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canManageAnmeldungen(roles)) {
    redirect("/anmeldungen");
  }
  const params = searchParams ? await searchParams : {};
  const vorwahlKursId = typeof params.kurs === "string" ? params.kurs : undefined;
  const optionen = await loadAnmeldungOptionen();

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/anmeldungen" className="text-sm text-brand-700 hover:text-brand-800">
          ← Anmeldungen
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Neue Anmeldung</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Tarif nach Tageszeit des Kursstarts, Paketgrösse 14/15, Preis aus der Preisliste — alles leer
          lassen für die Automatik, oder gezielt übersteuern.
        </p>
      </div>

      <div className="card p-5">
        <AnmeldungForm optionen={optionen} vorwahlKursId={vorwahlKursId} />
      </div>
    </div>
  );
}
