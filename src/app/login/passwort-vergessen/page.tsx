import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RequestResetForm } from "@/components/RequestResetForm";

export const metadata: Metadata = {
  title: "Passwort vergessen",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="card p-6">
          <h1 className="text-base font-semibold text-slate-900">Passwort zurücksetzen</h1>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Geben Sie die E-Mail-Adresse Ihres Kontos ein. Wir senden Ihnen einen Link, mit dem Sie
            ein neues Passwort festlegen können.
          </p>
          <Suspense fallback={null}>
            <RequestResetForm />
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
