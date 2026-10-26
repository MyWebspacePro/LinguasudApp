import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageVermietung } from "@/lib/auth/permissions";
import { ladeMieterOptionen, ladeRaumOptionen } from "@/lib/vermietung/daten";
import { SerieFormular } from "@/components/vermietung/VermietungFormen";

export const metadata: Metadata = {
  title: "Neue Vermietungs-Serie",
};

/**
 * Vermietungs-Serie anlegen (Modul 12): z.B. jeden Dienstag 18–20 Uhr,
 * 1.1.–31.12. — beim Anlegen materialisiert die Serie sofort alle Termine.
 */
export default function NeueSeriePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeueSerieContent />
    </Suspense>
  );
}

async function NeueSerieContent() {
  const { user } = await requireStaff();
  if (!canManageVermietung(user.roles as Role[])) redirect("/dashboard");

  const [mieter, raeume] = await Promise.all([ladeMieterOptionen(), ladeRaumOptionen()]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Neue Vermietungs-Serie</h1>
        <p className="mt-1 text-sm text-slate-600">
          Wiederkehrende Belegung (Montag–Samstag, Planer-Raster 06:30–23:00) —{" "}
          <Link href="/vermietungen/neu" className="font-medium text-brand-700 hover:text-brand-800">
            Einzeltermin erfassen
          </Link>
        </p>
      </div>
      <div className="card p-5">
        {mieter.length === 0 ? (
          <p className="text-sm text-slate-600">
            Noch keine Mieter — bitte zuerst in der{" "}
            <Link href="/vermietungen/mieter" className="font-medium text-brand-700 hover:text-brand-800">
              Mieterkartei
            </Link>{" "}
            anlegen.
          </p>
        ) : raeume.length === 0 ? (
          <p className="text-sm text-slate-600">Keine aktiven Räume — bitte in den Stammdaten pflegen.</p>
        ) : (
          <SerieFormular mieter={mieter} raeume={raeume} />
        )}
      </div>
    </div>
  );
}
