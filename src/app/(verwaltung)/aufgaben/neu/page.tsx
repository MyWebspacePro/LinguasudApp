import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db, roleList } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnfragen } from "@/lib/auth/permissions";
import { isStaff } from "@/lib/auth/permissions";
import { AufgabeFormular } from "@/components/aufgaben/AufgabenFormen";

export const metadata: Metadata = {
  title: "Neue Aufgabe",
};

/** Neue Aufgabe anlegen (Modul 13). */
export default function NeueAufgabePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NeueAufgabeContent />
    </Suspense>
  );
}

async function NeueAufgabeContent() {
  const { user } = await requireStaff();
  if (!canManageAnfragen(roleList(user.roles))) redirect("/dashboard");

  const [userRows, personRows, kursRows] = await Promise.all([
    db.orm.public.User.where({ isActive: true }).all(),
    db.orm.public.Person.orderBy((p) => p.nachname.asc()).all(),
    db.orm.public.Kurs.orderBy((k) => k.code.asc()).all(),
  ]);

  const stabsPersonen = userRows
    .filter((u) => isStaff(roleList(u.roles)))
    .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const personen = personRows.map((p) => ({
    id: p.id,
    label: `${p.vorname} ${p.nachname}${p.status === "INTERESSENT" ? " (Interessent/in)" : ""}`,
  }));
  const kurse = kursRows.map((k) => ({ id: k.id, label: k.code }));

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/aufgaben" className="text-sm text-slate-600 transition hover:text-brand-700">
          ← Aufgaben
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Neue Aufgabe</h1>
      </div>
      <div className="card p-5">
        <AufgabeFormular stabsPersonen={stabsPersonen} personen={personen} kurse={kurse} />
      </div>
    </div>
  );
}
