import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { db, isPastDbTime } from "@/lib/db";
import { hashToken } from "@/lib/auth/password";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Passwort festlegen",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Neues Passwort per Einmal-Link. Der Token wird serverseitig vorgeprüft,
 * damit abgelaufene/benutzte Links sofort erkennbar sind; verbindlich geprüft
 * wird er beim Absenden (Server Action).
 */
export default function SetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-svh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="card p-6">
          <Suspense fallback={null}>
            <SetPasswordContent searchParams={searchParams} />
          </Suspense>
        </div>

        <p className="mt-4 text-center">
          <Link href="/login" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  );
}

async function SetPasswordContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  const record = token
    ? await db.orm.public.PasswordResetToken.where({ tokenHash: hashToken(token) })
        .include("user")
        .first()
    : null;

  if (!record || record.usedAt !== null || isPastDbTime(record.expiresAt) || !record.user.isActive) {
    return (
      <div>
        <h1 className="text-base font-semibold text-slate-900">Link nicht mehr gültig</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Dieser Link ist abgelaufen (60 Minuten) oder wurde bereits verwendet. Fordern Sie einen
          neuen Link an.
        </p>
        <Link href="/login/passwort-vergessen" className="btn-primary w-full">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-base font-semibold text-slate-900">
        {record.user.passwordHash ? "Neues Passwort festlegen" : "Willkommen"}
      </h1>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        {record.user.passwordHash
          ? `Legen Sie ein neues Passwort für ${record.user.email} fest.`
          : `Für ${record.user.email} wurde ein Zugang eingerichtet — bitte legen Sie Ihr Passwort fest.`}
      </p>
      <ResetPasswordForm token={token} isNewAccount={!record.user.passwordHash} />
    </div>
  );
}
