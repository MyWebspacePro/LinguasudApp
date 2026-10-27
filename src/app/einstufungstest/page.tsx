import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";

export const metadata: Metadata = {
  title: "Einstufungstest · Sprachschule linguasud",
};

// Öffentliche Seite mit DB-Zugriff: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Online-Einstufungstest (Modul 13) — Sprachwahl: Sprachen mit erfassten
 * Test-Fragen werden angeboten; der Test selbst läuft je Sprache.
 */
export default function EinstufungstestPage() {
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Einstufungstest"
          untertitel="Finden Sie in wenigen Minuten Ihr Einstiegsniveau."
        />
        <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
          <Sprachwahl />
        </Suspense>
      </div>
    </main>
  );
}

async function Sprachwahl() {
  // Request-Time-Rendering: der DB-Client nutzt intern crypto.randomUUID(),
  // das nicht in den Prerender darf (bekannte Next-16-Einschränkung).
  await connection();
  const [sprachen, fragen] = await Promise.all([
    db.orm.public.Sprache.where({ active: true }).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Einstufungsfrage.where((f) => f.active.eq(true)).all(),
  ]);

  const fragenProSprache = new Map<string, number>();
  for (const f of fragen) {
    fragenProSprache.set(f.spracheId, (fragenProSprache.get(f.spracheId) ?? 0) + 1);
  }
  const angeboten = sprachen.filter((s) => (fragenProSprache.get(s.id) ?? 0) > 0);

  if (angeboten.length === 0) {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Der Einstufungstest wird gerade vorbereitet — noch sind keine Fragen erfasst.
        Kontaktieren Sie uns gerne direkt über das{" "}
        <Link href="/anfrage" className="font-medium text-brand-700 hover:text-brand-800">
          Anfrage-Formular
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line p-0">
      {angeboten.map((s) => (
        <Link
          key={s.id}
          href={`/einstufungstest/${s.id}`}
          className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-brand-50/60"
        >
          <span>
            <span className="text-sm font-semibold text-slate-900">{s.name}</span>
            <span className="ml-2 text-xs text-slate-500">
              {fragenProSprache.get(s.id)} Frage{fragenProSprache.get(s.id) === 1 ? "" : "n"}
            </span>
          </span>
          <span aria-hidden className="text-brand-700">→</span>
        </Link>
      ))}
    </div>
  );
}
