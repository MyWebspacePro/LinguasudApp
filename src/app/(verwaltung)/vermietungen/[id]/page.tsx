import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageVermietung, canViewVermietung } from "@/lib/auth/permissions";
import { formatDatum, formatDatumLang, timeFromMinutes, utcToZoned, weekdayOfDateKey, WOCHENTAG_NAMEN } from "@/lib/zeit";
import { ladeMieterOptionen, ladeRaumOptionen } from "@/lib/vermietung/daten";
import { VermietungsStatusBadge } from "@/components/vermietung/VermietungBadges";
import { VermietungAktionen, VermietungFormular } from "@/components/vermietung/VermietungFormen";
import { RECHNUNG_STATUS_LABELS, type RechnungStatus } from "@/lib/rechnungen/logik";

export const metadata: Metadata = {
  title: "Vermietung",
};

/** Vermietungs-Detail (Modul 12): Bearbeiten, Status, Absage, Rechnung, Löschen. */
export default function VermietungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <VermietungDetailContent params={params} />
    </Suspense>
  );
}

async function VermietungDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewVermietung(roles)) redirect("/dashboard");
  const kannVerwalten = canManageVermietung(roles);

  const vermietung = await db.orm.public.Vermietung
    .where({ id })
    .include("mieter")
    .include("raum")
    .include("serie")
    .include("rechnung")
    .first();
  if (!vermietung) notFound();

  const local = utcToZoned(fromDbTime(vermietung.startAt));
  const endZeit = timeFromMinutes(local.minuteOfDay + vermietung.dauerMinuten);
  const chf = (wert: number) => wert.toLocaleString("de-CH", { minimumFractionDigits: 2 });

  // Formular-Optionen: aktive Mieter/Räume — der aktuell verknüpfte (z.B.
  // inzwischen archivierte) bleibt auswählbar, damit das Speichern nicht
  // die Verknüpfung verliert.
  const [mieterOptionen, raumOptionen] = await Promise.all([ladeMieterOptionen(), ladeRaumOptionen()]);
  if (!mieterOptionen.some((m) => m.id === vermietung.mieterId)) {
    mieterOptionen.unshift({ id: vermietung.mieterId, label: `${vermietung.mieter.name} (archiviert)` });
  }
  if (!raumOptionen.some((r) => r.id === vermietung.raumId)) {
    raumOptionen.unshift({ id: vermietung.raumId, label: `${vermietung.raum.name} (archiviert)` });
  }

  const gesperrt = Boolean(vermietung.rechnungId);
  const abgesagt = vermietung.status === "ABGESAGT";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Vermietung · {formatDatum(local.dateKey)}{" "}
            <span className="text-slate-400">
              ({WOCHENTAG_NAMEN[weekdayOfDateKey(local.dateKey) - 1]}, {timeFromMinutes(local.minuteOfDay)}–{endZeit})
            </span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <VermietungsStatusBadge status={vermietung.status} />
            {vermietung.serie && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                aus Serie ({vermietung.serie.startZeit}–{vermietung.serie.endZeit},{" "}
                {formatDatum(String(vermietung.serie.von).slice(0, 10))}–{formatDatum(String(vermietung.serie.bis).slice(0, 10))})
              </span>
            )}
          </div>
        </div>
        <Link href="/vermietungen" className="btn-secondary px-3 py-1.5 text-xs">
          ← Vermietungen
        </Link>
      </div>

      <section className="card p-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-slate-500">Mieter</dt>
          <dd className="font-medium text-slate-800">
            {vermietung.mieter.name}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {vermietung.mieter.strasse}, {vermietung.mieter.plz} {vermietung.mieter.ort}
              {vermietung.mieter.email ? ` · ${vermietung.mieter.email}` : ""}
            </span>
          </dd>
          <dt className="text-slate-500">Raum</dt>
          <dd>{vermietung.raum.name}</dd>
          <dt className="text-slate-500">Termin</dt>
          <dd>
            {formatDatumLang(local.dateKey)} · {timeFromMinutes(local.minuteOfDay)}–{endZeit} ({vermietung.dauerMinuten} Min)
          </dd>
          <dt className="text-slate-500">Preis</dt>
          <dd className="tabular-nums">{chf(Number(vermietung.preisChf))} CHF</dd>
          {vermietung.notiz && (
            <>
              <dt className="text-slate-500">Notiz</dt>
              <dd>{vermietung.notiz}</dd>
            </>
          )}
          {vermietung.absageGrund && (
            <>
              <dt className="text-slate-500">Absage-Grund</dt>
              <dd className="text-red-700">{vermietung.absageGrund}</dd>
            </>
          )}
          <dt className="text-slate-500">Rechnung</dt>
          <dd>
            {vermietung.rechnung ? (
              <>
                <Link
                  href={`/rechnungen/${vermietung.rechnung.id}`}
                  className="font-mono font-medium text-brand-700 hover:text-brand-800"
                >
                  {vermietung.rechnung.nummer}
                </Link>{" "}
                <span className="text-xs text-slate-500">
                  ({RECHNUNG_STATUS_LABELS[vermietung.rechnung.status as RechnungStatus]})
                </span>
              </>
            ) : abgesagt ? (
              <span className="text-xs text-slate-500">abgesagt — keine Abrechnung</span>
            ) : (
              <span className="text-xs text-slate-500">noch kein Entwurf</span>
            )}
          </dd>
        </dl>
      </section>

      {kannVerwalten && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Aktionen</h2>
          <VermietungAktionen
            vermietung={{
              id: vermietung.id,
              status: vermietung.status,
              mieterName: vermietung.mieter.name,
              hatRechnung: gesperrt,
            }}
          />
        </section>
      )}

      {kannVerwalten && !gesperrt && !abgesagt && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Bearbeiten</h2>
          <VermietungFormular
            mieter={mieterOptionen}
            raeume={raumOptionen}
            vermietung={{
              id: vermietung.id,
              mieterId: vermietung.mieterId,
              raumId: vermietung.raumId,
              datum: local.dateKey,
              startZeit: timeFromMinutes(local.minuteOfDay),
              endZeit,
              preisChf: Number(vermietung.preisChf).toFixed(2),
              status: vermietung.status,
              notiz: vermietung.notiz,
            }}
          />
        </section>
      )}
      {kannVerwalten && gesperrt && (
        <p className="card p-4 text-xs text-slate-500">
          Bearbeiten gesperrt: Es existiert eine Rechnung ({vermietung.rechnung?.nummer}). Um den Termin zu ändern,
          zuerst den Rechnungs-Entwurf löschen (nur im Status «Entwurf» möglich) — oder die Vermietung absagen und
          neu erfassen.
        </p>
      )}
      {kannVerwalten && abgesagt && !gesperrt && (
        <p className="card p-4 text-xs text-slate-500">
          Abgesagte Vermietungen können gelöscht werden (Button oben) — eine Wiederaktivierung erfolgt durch
          Neuerfassen.
        </p>
      )}
    </div>
  );
}
