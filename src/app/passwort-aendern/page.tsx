import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { landingRoute } from "@/lib/auth/permissions";
import { roleList } from "@/lib/db";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Passwort ändern",
};

// Auth-lastige Route: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Eigenes Passwort ändern — freiwillig aus der Navigation oder erzwungen
 * nach Erstvergabe/Admin-Reset (Ziel der Umleitung bei mustChangePassword).
 */
export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={null}>
          <ChangePasswordGate />
        </Suspense>
      </div>
    </main>
  );
}

async function ChangePasswordGate() {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }

  const forced = ctx.user.mustChangePassword;

  return (
    <div className="card p-6">
      <h1 className="text-base font-semibold text-slate-900">Passwort ändern</h1>
      {forced ? (
        <div className="alert-info mt-3">
          Für Ihr Konto wurde ein neues Passwort festgelegt. Bitte setzen Sie jetzt Ihr eigenes
          Passwort, um fortzufahren.
        </div>
      ) : (
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Wählen Sie ein neues Passwort (mindestens 20 Zeichen). Nach dem Wechsel werden alle
          anderen Sitzungen abgemeldet.
        </p>
      )}
      <div className={forced ? "" : "mt-5"}>
        <ChangePasswordForm continueHref={landingRoute(roleList(ctx.user.roles))} />
      </div>
    </div>
  );
}
