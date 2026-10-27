import Link from "next/link";
import type { ReactNode } from "react";

import { UI_TEXT, type Locale } from "@/lib/website/logik";
import type { FussEintrag, NavEintrag } from "@/lib/website/daten";
import { WebsitePopupOverlay, type PopupDaten } from "./WebsitePopupOverlay";

/**
 * Rahmen der öffentlichen Website (Modul 15): Kopf mit Navigation und
 * DE/EN-Umschaltung, Inhalt, Fuss mit Rechtsseiten. Server Component —
 * das Pop-up wird serverseitig entschieden (Zeitfenster + Cookie) und
 * kommt ohne Layout-Flackern direkt im SSR-HTML mit.
 */
export async function WebsiteRahmen({
  locale,
  pfad,
  nav,
  fuss,
  popup,
  popupGeschlossen,
  children,
}: {
  locale: Locale;
  /** Aktueller Pfad ohne Locale-Präfix («», «ueber-uns», «sprachen/deutsch»). */
  pfad: string;
  nav: NavEintrag[];
  fuss: FussEintrag[];
  popup: PopupDaten | null;
  popupGeschlossen: boolean;
  children: ReactNode;
}) {
  const t = UI_TEXT[locale];
  const andererLocaleHref = locale === "de" ? `/en${pfad ? `/${pfad}` : ""}` : pfad ? `/${pfad}` : "/";

  return (
    <div lang={locale} className="flex min-h-svh flex-col">
      <header className="border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href={locale === "de" ? "/" : "/en"} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-700 text-base font-semibold text-white">
              L
            </span>
            <span className="text-sm font-semibold text-slate-900">linguasud</span>
          </Link>
          <nav aria-label={t.start} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {nav.map((eintrag) => (
              <Link
                key={eintrag.href}
                href={locale === "de" ? eintrag.href : `/en${eintrag.href === "/" ? "" : eintrag.href}`}
                className="text-slate-700 transition hover:text-brand-700"
              >
                {eintrag.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={andererLocaleHref}
              className="rounded-md border border-line px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-800"
              hrefLang={locale === "de" ? "en" : "de"}
            >
              {locale === "de" ? "EN" : "DE"}
            </Link>
            <Link href="/login" className="text-slate-500 transition hover:text-brand-700">
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-slate-600">
          <span>© {new Date().getFullYear()} Sprachschule linguasud · Schaffhausen &amp; Winterthur</span>
          <span className="flex flex-wrap items-center gap-4">
            {fuss.map((eintrag) => (
              <Link
                key={eintrag.href}
                href={locale === "de" ? eintrag.href : `/en${eintrag.href}`}
                className="transition hover:text-brand-700"
              >
                {eintrag.label}
              </Link>
            ))}
            <Link href="/anfrage" className="transition hover:text-brand-700">
              {t.anfrage}
            </Link>
            <Link href="/einstufungstest" className="transition hover:text-brand-700">
              {t.einstufungstest}
            </Link>
          </span>
        </div>
      </footer>

      {popup && !popupGeschlossen && (
        <WebsitePopupOverlay popup={popup} />
      )}
    </div>
  );
}
