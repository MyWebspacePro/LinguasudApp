import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManagePersonen } from "@/lib/auth/permissions";
import { PersonForm } from "@/components/personen/PersonForm";

export const metadata: Metadata = {
  title: "Neue Person",
};

/** Person anlegen (Modul 3) — Admin/Chef/Büro. */
export default async function NeuePersonPage() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManagePersonen(roles)) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/personen" className="text-sm text-slate-600 hover:text-brand-700">
          ← Personen-Kartei
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Neue Person</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Neue Personen starten als «Interessent/in» und werden bei der Anmeldung weiterverwendet.
        </p>
      </div>

      <section className="card p-5">
        <PersonForm />
      </section>
    </div>
  );
}
