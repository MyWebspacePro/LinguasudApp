import Link from "next/link";

/** 404 der öffentlichen Website (Modul 15). */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 text-center">
        <p className="text-sm font-semibold text-brand-700">404</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Seite nicht gefunden</h1>
        <p className="mt-1 text-sm text-slate-600">Diese Seite existiert nicht (mehr).</p>
        <Link href="/" className="btn-primary mt-4">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
