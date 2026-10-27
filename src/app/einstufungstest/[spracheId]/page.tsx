import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";
import { SubmitButton } from "@/components/SubmitButton";
import { einstufungsTestAction } from "@/lib/anfragen/actions";

export const metadata: Metadata = {
  title: "Einstufungstest · Sprachschule linguasud",
};

// Öffentliche Seite mit DB-Zugriff: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/** Wie viele Fragen je Niveau in den Test kommen (Reihenfolge aus den Stammdaten). */
const FRAGEN_PRO_NIVEAU = 3;

/**
 * Der Test: Multiple-Choice-Fragen je Niveau (aufsteigend), beantwortet ohne
 * Login — die Auswertung läuft serverseitig und führt zur Empfehlung weiter.
 */
export default async function EinstufungstestSprachePage({
  params,
}: {
  params: Promise<{ spracheId: string }>;
}) {
  const { spracheId } = await params;
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Einstufungstest"
          untertitel="Beantworten Sie die Fragen ohne Hilfe — so stimmt die Empfehlung am besten."
        />
        <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-slate-100" />}>
          <TestFormular spracheId={spracheId} />
        </Suspense>
      </div>
    </main>
  );
}

async function TestFormular({ spracheId }: { spracheId: string }) {
  // Request-Time-Rendering: der DB-Client nutzt intern crypto.randomUUID().
  await connection();
  const sprache = await db.orm.public.Sprache.where({ id: spracheId }).first();
  if (!sprache) notFound();

  const [fragen, niveaus] = await Promise.all([
    db.orm.public.Einstufungsfrage
      .where((f) => f.spracheId.eq(spracheId))
      .where((f) => f.active.eq(true))
      .orderBy((f) => f.sortOrder.asc())
      .all(),
    db.orm.public.Niveau.orderBy((n) => n.sortOrder.asc()).all(),
  ]);
  if (fragen.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Für {sprache.name} sind noch keine Fragen erfasst.{" "}
        <Link href="/anfrage" className="font-medium text-brand-700 hover:text-brand-800">
          Direkt eine Anfrage stellen
        </Link>
      </div>
    );
  }

  // Fragen je Niveau gruppieren (aufsteigend nach Niveau-Sortierung), pro
  // Stufe die ersten FRAGEN_PRO_NIVEAU.
  const niveauReihenfolge = new Map(niveaus.map((n, i) => [n.id, i]));
  const proNiveau = new Map<string, typeof fragen>();
  for (const frage of fragen) {
    const liste = proNiveau.get(frage.niveauId) ?? [];
    if (liste.length < FRAGEN_PRO_NIVEAU) liste.push(frage);
    proNiveau.set(frage.niveauId, liste);
  }
  const gruppen = [...proNiveau.entries()]
    .sort(([a], [b]) => (niveauReihenfolge.get(a) ?? 99) - (niveauReihenfolge.get(b) ?? 99));

  return (
    <form action={einstufungsTestAction} className="space-y-4">
      <input type="hidden" name="spracheId" value={sprache.id} />
      {gruppen.map(([niveauId, liste]) => {
        const niveau = niveaus.find((n) => n.id === niveauId);
        return (
          <section key={niveauId} className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Niveau {niveau?.code ?? "?"}
              {niveau?.name ? ` · ${niveau.name}` : ""}
            </p>
            <ol className="mt-3 space-y-5">
              {liste.map((frage) => (
                <li key={frage.id} className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">{frage.text}</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {[frage.antwort1, frage.antwort2, frage.antwort3, frage.antwort4].map((antwort, i) => (
                      <label
                        key={i}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-slate-700 transition hover:bg-brand-50/50 has-checked:border-brand-600 has-checked:bg-brand-50"
                      >
                        <input
                          type="radio"
                          name={`f_${frage.id}`}
                          value={i + 1}
                          className="accent-brand-700"
                          required
                        />
                        {antwort}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-xs text-slate-500">
          Alle Fragen beantworten — bei schweren Fragen schätzen Sie einfach.
        </p>
        <SubmitButton className="btn-primary" pendingText="Wertet aus…">
          Test abschliessen
        </SubmitButton>
      </div>
    </form>
  );
}
