import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";
import { OeffentlichesAnfrageFormular } from "@/components/oeffentlich/AnfrageFormular";
import { parseTestResultat } from "@/lib/anfragen/logik";

export const metadata: Metadata = {
  title: "Anfrage · Sprachschule linguasud",
};

// Öffentliche Seite mit DB-Zugriff: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Öffentliches Anfrage-Formular (Modul 13): Name, E-Mail, Telefon, gewünschte
 * Sprache/Niveau, Nachricht — mit Empfehlung aus dem Einstufungstest
 * vorbelegt (editierbar). Nach dem Absenden: Bestätigungs-Mail, Büro-Mail
 * und automatische Aufgabe (in der Server-Action).
 */
export default function AnfragePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Anfrage stellen"
          untertitel="Wir melden uns in den nächsten Tagen bei Ihnen."
        />
        <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-slate-100" />}>
          <AnfrageInhalt searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function AnfrageInhalt({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const wert = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

  const [sprachen, niveaus] = await Promise.all([
    db.orm.public.Sprache.where({ active: true }).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Niveau.where({ active: true }).orderBy((n) => n.sortOrder.asc()).all(),
  ]);

  // Empfehlung aus dem Einstufungstest: Sprache vorbelegen, Niveau auf die
  // Empfehlung (editierbar), Hinweis mit Begründung anzeigen.
  const testResultat = parseTestResultat(wert("res"));
  const spracheId = wert("sprache");
  const empfohlenesNiveau = testResultat?.empfehlungCode
    ? (await db.orm.public.Niveau.where({ code: testResultat.empfehlungCode }).first())
    : null;
  const empfehlungHinweis =
    empfohlenesNiveau && testResultat
      ? `Empfehlung aus Ihrem Einstufungstest: Niveau ${empfohlenesNiveau.code} — Sie können das Niveau unten anpassen.`
      : null;

  return (
    <OeffentlichesAnfrageFormular
      sprachen={sprachen.map((s) => ({ id: s.id, name: s.name }))}
      niveaus={niveaus.map((n) => ({ id: n.id, code: n.code }))}
      vorbefuellung={{
        spracheId,
        niveauId: empfohlenesNiveau?.id ?? "",
        res: wert("res"),
        empfehlungHinweis,
      }}
    />
  );
}
