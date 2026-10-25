import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { NeueRechnungForm, type EmpfaengerOption } from "@/components/rechnungen/RechnungsFormen";

export const metadata: Metadata = {
  title: "Neue Rechnung",
};

/** Neue Rechnung (Modul 9) — manuell durchs Büro, auch Behörden im Nachhinein. */
export default function NeueRechnungPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeueRechnungContent />
    </Suspense>
  );
}

async function NeueRechnungContent() {
  const { user } = await requireStaff();
  if (!canManageAnmeldungen(user.roles as Role[])) redirect("/dashboard");

  const [personen, kostentraeger] = await Promise.all([
    db.orm.public.Person.orderBy((p) => p.nachname.asc()).orderBy((p) => p.vorname.asc()).all(),
    db.orm.public.Kostentraeger.where({ active: true }).orderBy((k) => k.name.asc()).all(),
  ]);

  const optionen: EmpfaengerOption[] = [
    ...personen.map((p) => ({
      id: p.id,
      typ: "person" as const,
      label: `${p.vorname} ${p.nachname}${p.plz || p.ort ? ` — ${p.plz ?? ""} ${p.ort ?? ""}`.trim() : ""}`,
    })),
    ...kostentraeger.map((k) => ({
      id: k.id,
      typ: "kostentraeger" as const,
      label: `${k.name}${k.art === "OEFFENTLICHE_EINRICHTUNG" ? " (öffentliche Einrichtung)" : ""} — ${k.plz} ${k.ort}`,
    })),
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/rechnungen" className="text-sm text-brand-700 hover:text-brand-800">
          ← Rechnungen
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Neue Rechnung</h1>
        <p className="mt-1 text-sm text-slate-600">
          Rechnung als Entwurf erfassen — mehrere Positionen (Paket, Lehrmittel, Registration …),
          optional MwSt, Zahlungsfrist 30 Tage (Standard). Empfänger mit abweichender
          Rechnungsadresse bekommt diese automatisch.
        </p>
      </div>

      <div className="card p-5">
        <NeueRechnungForm optionen={optionen} />
      </div>
    </div>
  );
}
