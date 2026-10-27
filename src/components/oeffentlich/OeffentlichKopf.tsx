import Link from "next/link";

/**
 * Geteilter Kopf der öffentlichen Seiten (Einstufungstest, Anfrage — Modul 13).
 * Bewusst schlicht, bis die eigentliche Website mit CMS entsteht (Modul 15).
 */
export function OeffentlichKopf({ titel, untertitel }: { titel: string; untertitel: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-700 text-base font-semibold text-white"
          aria-label="Startseite"
        >
          L
        </Link>
        <div>
          <h1 className="text-lg leading-tight font-semibold text-slate-900">{titel}</h1>
          <p className="text-sm text-slate-600">{untertitel}</p>
        </div>
      </div>
    </div>
  );
}
