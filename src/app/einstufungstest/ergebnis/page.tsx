import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";
import { niveauEmpfehlung, parseTestResultat } from "@/lib/anfragen/logik";

export const metadata: Metadata = {
  title: "Einstufungstest – Ergebnis · Sprachschule linguasud",
};

// Öffentliche Seite mit DB-Zugriff: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Test-Ergebnis (Modul 13): Niveau-Empfehlung mit Begründung — führt weiter
 * zum Anfrage-Formular, wo die Empfehlung vorbefüllt und editierbar ist.
 */
export default function EinstufungstestErgebnisPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Ihr Ergebnis"
          untertitel="Die Empfehlung können Sie mit der Anfrage übernehmen oder anpassen."
        />
        <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
          <Ergebnis searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Ergebnis({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const res = parseTestResultat(str("res"));
  const spracheId = str("sprache");
  const niveauId = str("niveau");

  if (!res) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Das Ergebnis konnte nicht gelesen werden.{" "}
        <Link href="/einstufungstest" className="font-medium text-brand-700 hover:text-brand-800">
          Bitte wiederholen Sie den Test
        </Link>{" "}
        oder stellen Sie direkt eine{" "}
        <Link href="/anfrage" className="font-medium text-brand-700 hover:text-brand-800">
          Anfrage
        </Link>
        .
      </div>
    );
  }

  const sprache = spracheId ? await db.orm.public.Sprache.where({ id: spracheId }).first() : null;
  const empfohlenesNiveau = res.empfehlungCode
    ? (await db.orm.public.Niveau.where({ code: res.empfehlungCode }).first())
    : null;
  const empfehlung = niveauEmpfehlung(res.proNiveau);

  const anfrageParams = new URLSearchParams();
  if (sprache) anfrageParams.set("sprache", sprache.id);
  const zielNiveauId = empfohlenesNiveau?.id ?? niveauId;
  if (zielNiveauId) anfrageParams.set("niveau", zielNiveauId);
  anfrageParams.set("res", str("res"));

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {sprache ? `Einstufungstest ${sprache.name}` : "Einstufungstest"}
        </p>
        <p className="mt-2 text-3xl font-semibold text-brand-700">
          {empfehlung ? `Niveau ${empfehlung.code}` : "—"}
        </p>
        {empfehlung && <p className="mt-2 text-sm text-slate-600">{empfehlung.begruendung}</p>}

        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <th className="py-1.5 text-left font-medium text-slate-500">Stufe</th>
              <th className="py-1.5 text-right font-medium text-slate-500">Richtig</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {res.proNiveau.map((e) => (
              <tr key={e.code}>
                <td className="py-1.5 text-slate-700">{e.code}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-700">
                  {e.richtig}/{e.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-slate-600">
          Passt die Empfehlung für Sie? Stellen Sie Ihre Anfrage — wir melden uns in den nächsten Tagen.
        </p>
        <Link href={`/anfrage?${anfrageParams.toString()}`} className="btn-primary whitespace-nowrap">
          Anfrage stellen
        </Link>
      </div>
    </div>
  );
}
