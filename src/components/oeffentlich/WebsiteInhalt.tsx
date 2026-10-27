// Rendering der CMS-Inhalte (Modul 15): der Klartext aus der Verwaltung wird
// in Absätze, Zwischentitel und Aufzählungen übersetzt (parseInhalt, pure).

import { parseInhalt, type Locale } from "@/lib/website/logik";
import type { OeffentlicherKurs } from "@/lib/website/daten";
import { plaetzeLabel, UI_TEXT } from "@/lib/website/logik";
import Link from "next/link";

export function WebsiteInhalt({ inhalt }: { inhalt: string }) {
  const bloecke = parseInhalt(inhalt);
  return (
    <div className="space-y-4">
      {bloecke.map((block, i) => {
        if (block.art === "titel") {
          return (
            <h2 key={i} className="pt-2 text-base font-semibold text-slate-900">
              {block.text}
            </h2>
          );
        }
        if (block.art === "liste") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {block.punkte.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-700">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

/** Live-Kursliste einer Sprache: nur Gruppenkurse mit freien Plätzen. */
export function KursListe({
  kurse,
  locale,
  spracheId,
}: {
  kurse: OeffentlicherKurs[];
  locale: Locale;
  spracheId: string;
}) {
  const t = UI_TEXT[locale];
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-slate-900">{t.kurseMitPlaetzen}</h2>
      {kurse.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{t.keineKurse}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {kurse.map((kurs) => (
            <li key={kurs.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t.nivellabel} {kurs.niveau} · {kurs.kursart}
                  </p>
                  {kurs.termin && <p className="mt-0.5 text-sm text-slate-600">{kurs.termin}</p>}
                  {kurs.ort && <p className="text-xs text-slate-500">{kurs.ort}</p>}
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {plaetzeLabel(kurs.freiePlaetzeAnzahl, locale)}
                </span>
              </div>
              <Link
                href={`/anfrage?sprache=${spracheId}&niveauCode=${kurs.niveau}`}
                className="btn-secondary mt-3 px-3 py-1.5 text-xs"
              >
                {t.kursAnfrage}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** CTA-Karten (Kontakt-Seite und Startseite) zu den bestehenden Modul-13-Formularen. */
export function HandlungsKarten({ locale }: { locale: Locale }) {
  const t = UI_TEXT[locale];
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Link href="/einstufungstest" className="card block p-5 transition hover:bg-brand-50/60">
        <p className="text-sm font-semibold text-slate-900">{t.einstufungstest}</p>
        <p className="mt-1 text-sm text-slate-600">{t.einstufungstestBeschreibung}</p>
      </Link>
      <Link href="/anfrage" className="card block p-5 transition hover:bg-brand-50/60">
        <p className="text-sm font-semibold text-slate-900">{t.anfrage}</p>
        <p className="mt-1 text-sm text-slate-600">{t.anfrageBeschreibung}</p>
      </Link>
    </div>
  );
}
