import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Anmelden",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-700 text-base font-semibold text-white">
            L
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold text-slate-900">
              Linguasud Verwaltung
            </h1>
            <p className="text-sm text-slate-600">Sprachschule linguasud.com</p>
          </div>
        </div>

        <div className="card p-6">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>

          <div className="mt-4 border-t border-line pt-4 text-center">
            <Link
              href="/login/passwort-vergessen"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Passwort vergessen?
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Konten werden ausschliesslich durch das Verwaltungsteam eingerichtet.
        </p>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-9 w-full animate-pulse rounded-md bg-slate-100" />
      <div className="h-9 w-full animate-pulse rounded-md bg-slate-100" />
      <div className="h-9 w-full animate-pulse rounded-md bg-brand-100" />
    </div>
  );
}
