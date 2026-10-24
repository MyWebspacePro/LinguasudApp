import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/permissions";
import { ALL_ROLES, BUERO_ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import { getEnv, isMailConfigured } from "@/lib/env";
import { UserCreateForm } from "@/components/users/UserCreateForm";

export const metadata: Metadata = {
  title: "Neues Konto",
};

/** Konto anlegen — nur Büro/Admin, keine Selbstregistrierung. */
export default function NewUserPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <NewUserContent />
    </Suspense>
  );
}

async function NewUserContent() {
  const { user: actor } = await requireStaff();
  const actorRoles = actor.roles as Role[];
  if (!hasRole(actorRoles, "ADMIN") && !hasRole(actorRoles, "BUERO")) {
    redirect("/dashboard");
  }

  const assignable = hasRole(actorRoles, "ADMIN") ? ALL_ROLES : [...BUERO_ASSIGNABLE_ROLES];
  const env = getEnv();
  const emailInviteAvailable = isMailConfigured(env) || env.APP_ENV === "development";

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Link href="/benutzer" className="text-sm text-slate-600 hover:text-brand-700">
          ← Benutzerliste
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Neues Konto anlegen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Konten werden nur hier eingerichtet — eine Selbstregistrierung gibt es nicht.
        </p>
      </div>

      <div className="card p-5">
        <UserCreateForm assignableRoles={assignable} emailInviteAvailable={emailInviteAvailable} />
      </div>
    </div>
  );
}
