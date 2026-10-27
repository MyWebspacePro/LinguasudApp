import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canAdminKi, canViewKi } from "@/lib/auth/permissions";
import { ladeKiLektionen } from "@/lib/ki/daten";
import { KI_MODUS_LABELS } from "@/lib/ki/logik";
import { dateKeyOf, formatDatum } from "@/lib/zeit";

export const metadata: Metadata = {
  title: "KI-Bibliothek",
};

export default function KiBibliothekPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KiBibliothekContent searchParams={searchParams} />
    </Suspense>
  );
}

async function KiBibliothekContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewKi(roles)) redirect("/dashboard");
  const istAdmin = canAdminKi(roles);

  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const lektionen = await ladeKiLektionen(user.id, { suche: q || undefined });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">KI-Bibliothek</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Eigene Lektionen und Freigaben des Kollegiums — maximal die letzten 100 Einträge.
          </p>
        </div>
        <Link href="/ki-generator" className="btn-primary">
          Neue Lektion generieren
        </Link>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-44 flex-1">
          <label htmlFor="filter-q" className="label">
            Suche
          </label>
          <input
            id="filter-q"
            name="q"
            defaultValue={q}
            placeholder="Titel, Thema, Ersteller/in oder Modell …"
            className="input"
          />
        </div>
        <button type="submit" className="btn-secondary">
          Suchen
        </button>
        {q && (
          <Link href="/ki-generator/bibliothek" className="text-sm text-slate-600 underline">
            Zurücksetzen
          </Link>
        )}
      </form>

      {lektionen.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          {q
            ? "Keine Lektionen zu dieser Suche gefunden."
            : "Noch keine Lektionen gespeichert — starte mit «Neue Lektion generieren»."}
        </div>
      ) : (
        <ul className="space-y-2">
          {lektionen.map((l) => {
            const eigene = l.erstelltVonUserId === user.id;
            return (
              <li key={l.id} className="card p-4 transition hover:border-brand-300 hover:shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/ki-generator/${l.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                      {l.titel}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{l.thema || "—"}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {KI_MODUS_LABELS[l.modus]}
                      </span>
                      {l.sprache?.name && <span>{l.sprache.name}</span>}
                      {l.niveau?.code && <span>· {l.niveau.code}</span>}
                      <span>· {l.erstelltVonName}</span>
                      <span>· {formatDatum(dateKeyVon(l.createdAt))}</span>
                      {l.modell && <span>· {l.modell}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.geteilt && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        geteilt
                      </span>
                    )}
                    {!eigene && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Kollegium
                      </span>
                    )}
                    {eigene && !istAdmin && (
                      <span className="text-[11px] text-slate-400">eigene</span>
                    )}
                    <Link href={`/ki-generator/${l.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                      Öffnen
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** createdAt (Date oder String) → Kalendertag "YYYY-MM-DD". */
function dateKeyVon(wert: unknown): string {
  if (wert instanceof Date) return dateKeyOf(wert);
  const s = String(wert ?? "");
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? dateKeyOf(new Date()) : dateKeyOf(date);
}
