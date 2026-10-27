import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canAdminKi, canViewKi } from "@/lib/auth/permissions";
import { ladeKiLektion } from "@/lib/ki/daten";
import { KI_MODUS_LABELS } from "@/lib/ki/logik";
import { ergebnisFuerModus } from "@/lib/ki/pdf";
import { dateKeyOf, formatDatum } from "@/lib/zeit";
import { KiVorschlagAnzeige } from "@/components/ki/KiVorschlagAnzeige";
import { KiAktionen } from "@/components/ki/KiAktionen";

export const metadata: Metadata = {
  title: "KI-Lektion",
};

export default function KiLektionDetailPage({
  params,
}: {
  params: Promise<{ lektionId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KiLektionDetailContent params={params} />
    </Suspense>
  );
}

async function KiLektionDetailContent({ params }: { params: Promise<{ lektionId: string }> }) {
  const { lektionId } = await params;
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewKi(roles)) redirect("/dashboard");

  const istAdmin = canAdminKi(roles);
  const row = await ladeKiLektion(lektionId, user.id, istAdmin);
  if (!row) notFound();

  const eigene = row.erstelltVonUserId === user.id;
  const darfVerwalten = eigene || istAdmin;
  const ergebnis = ergebnisFuerModus(row.ergebnis, row.modus);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{row.titel}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {KI_MODUS_LABELS[row.modus]}
            </span>
            {row.sprache?.name && <span>{row.sprache.name}</span>}
            {row.niveau?.code && <span>· {row.niveau.code}</span>}
            {row.kursart?.name && <span>· {row.kursart.name}</span>}
            <span>· {row.erstelltVonName}</span>
            <span>· {formatDatum(dateKeyVon(row.createdAt))}</span>
            {row.modell && <span>· {row.modell}</span>}
            {row.geteilt && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
                für Kollegium freigegeben
              </span>
            )}
          </p>
        </div>
        <Link href="/ki-generator/bibliothek" className="btn-secondary">
          Zur Bibliothek
        </Link>
      </div>

      {row.thema && <p className="text-sm text-slate-600">{row.thema}</p>}

      <div className="card p-5">
        {ergebnis ? (
          <KiVorschlagAnzeige modus={row.modus} ergebnis={ergebnis} />
        ) : (
          <p className="text-sm text-slate-500">Für diese Lektion ist kein druckbares Ergebnis gespeichert.</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Aktionen</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {row.tokenInput !== null && row.tokenOutput !== null
            ? `${row.tokenInput} + ${row.tokenOutput} Tokens`
            : "Tokenverbrauch unbekannt"}
          {row.dauerMs ? ` · ${(row.dauerMs / 1000).toFixed(1)} s` : ""}
        </p>
        <div className="mt-3">
          <KiAktionen
            id={row.id}
            geteilt={row.geteilt}
            pdfHref={`/ki-generator/${row.id}/pdf`}
            darfVerwalten={darfVerwalten}
          />
        </div>
      </div>

      <details className="card p-5 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Verwendeter Prompt</summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-50 p-3 text-xs whitespace-pre-wrap">
          {row.prompt}
        </pre>
      </details>
    </div>
  );
}

/** createdAt (Date oder String aus der DB) → Kalendertag in der Schul-Zeitzone. */
function dateKeyVon(wert: unknown): string {
  if (wert instanceof Date) return dateKeyOf(wert);
  const s = String(wert ?? "");
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? dateKeyOf(new Date()) : dateKeyOf(date);
}
