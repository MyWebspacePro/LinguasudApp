import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewVermietung } from "@/lib/auth/permissions";
import { formatDatum, timeFromMinutes, utcToZoned, weekdayOfDateKey, WOCHENTAG_NAMEN } from "@/lib/zeit";
import { VermietungsStatusBadge } from "@/components/vermietung/VermietungBadges";
import { SerienSektion, type SerienZeile } from "@/components/vermietung/SerienSektion";

export const metadata: Metadata = {
  title: "Vermietung",
};

/**
 * Vermietungs-Übersicht (Modul 12): Termine (einzelne + aus Serien) mit
 * Status und Rechnungs-Verknüpfung sowie die Serien-Verwaltung. Blöcke im
 * Raumplaner sind unter /planer sichtbar.
 */
export default function VermietungenPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <VermietungenContent />
    </Suspense>
  );
}

async function VermietungenContent() {
  const { user } = await requireStaff();
  if (!canViewVermietung(user.roles as Role[])) redirect("/dashboard");

  const [vermietungen, serien] = await Promise.all([
    db.orm.public.Vermietung.orderBy((v) => v.startAt.desc()).limit(200).all(),
    db.orm.public.VermietungSerie.orderBy((s) => s.von.desc()).all(),
  ]);

  // Bezugsdaten per ID-Map (Muster Planer).
  const [mieterRows, raumRows, rechnungRows] = await Promise.all([
    db.orm.public.VermietungMieter.all(),
    db.orm.public.Raum.all(),
    db.orm.public.Rechnung.all(),
  ]);
  const mieterById = new Map(mieterRows.map((m) => [m.id, m]));
  const raumById = new Map(raumRows.map((r) => [r.id, r]));
  const rechnungById = new Map(rechnungRows.map((r) => [r.id, r]));

  // Serien: Anzahl Termine + verbleibende geplante (für die Lösch-Hinweise).
  const serieIds = serien.map((s) => s.id);
  const serienTermine = serieIds.length
    ? await db.orm.public.Vermietung.where((v) => v.serieId.in(serieIds)).all()
    : [];
  const zaehlerProSerie = new Map<string, { total: number; kommende: string | null }>();
  const heute = new Date();
  for (const t of serienTermine) {
    if (!t.serieId) continue;
    const eintrag = zaehlerProSerie.get(t.serieId) ?? { total: 0, kommende: null };
    eintrag.total += 1;
    if (
      t.status === "GEPLANT" &&
      !t.rechnungId &&
      fromDbTime(t.startAt).getTime() >= heute.getTime() &&
      (!eintrag.kommende || t.startAt < eintrag.kommende)
    ) {
      eintrag.kommende = t.startAt;
    }
    zaehlerProSerie.set(t.serieId, eintrag);
  }

  const serienZeilen: SerienZeile[] = serien.map((s) => {
    const zaehler = zaehlerProSerie.get(s.id) ?? { total: 0, kommende: null };
    return {
      id: s.id,
      mieterName: mieterById.get(s.mieterId)?.name ?? "(Mieter gelöscht)",
      raumName: raumById.get(s.raumId)?.name ?? "?",
      wochentagLabel: `jeden ${WOCHENTAG_NAMEN[s.wochentag - 1]}`,
      startZeit: s.startZeit,
      endZeit: s.endZeit,
      zeitraumLabel: `${formatDatum(String(s.von).slice(0, 10))}–${formatDatum(String(s.bis).slice(0, 10))}`,
      totalTermine: zaehler.total,
      kommendeGeplante: zaehler.kommende ? formatDatum(String(zaehler.kommende).slice(0, 10)) : null,
      preisLabel: Number(s.preisChf).toLocaleString("de-CH", { minimumFractionDigits: 2 }),
      notiz: s.notiz,
    };
  });

  const chf = (wert: number) => wert.toLocaleString("de-CH", { minimumFractionDigits: 2 });

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Raumvermietung</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vermietungen &amp; Serien mit QR-Rechnung (Modul 9, Empfänger = Mieter) · Blöcke im{" "}
            <Link href="/planer" className="font-medium text-brand-700 hover:text-brand-800">
              Raumplaner
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/vermietungen/mieter" className="btn-secondary">
            Mieterkartei
          </Link>
          <Link href="/vermietungen/serie/neu" className="btn-secondary">
            Neue Serie
          </Link>
          <Link href="/vermietungen/neu" className="btn-primary">
            Neue Vermietung
          </Link>
        </div>
      </div>

      <SerienSektion serien={serienZeilen} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Termine</h2>
        {vermietungen.length === 0 ? (
          <div className="card p-6 text-sm text-slate-600">
            Noch keine Vermietungen. Einzeltermin über «Neue Vermietung», wiederkehrende Belegung über «Neue Serie».
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-200 text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Datum</th>
                  <th className="th">Zeit</th>
                  <th className="th">Raum</th>
                  <th className="th">Mieter</th>
                  <th className="th">Preis</th>
                  <th className="th">Status</th>
                  <th className="th">Rechnung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vermietungen.map((v) => {
                  const local = utcToZoned(fromDbTime(v.startAt));
                  const mieter = mieterById.get(v.mieterId);
                  const raum = raumById.get(v.raumId);
                  const rechnung = v.rechnungId ? rechnungById.get(v.rechnungId) : null;
                  const abgelaufen = v.status !== "ABGESAGT" && fromDbTime(v.startAt).getTime() < heute.getTime();
                  return (
                    <tr key={v.id} className={abgelaufen ? "text-slate-400 hover:bg-slate-50/60" : "hover:bg-slate-50/60"}>
                      <td className="td whitespace-nowrap">
                        <Link href={`/vermietungen/${v.id}`} className={`font-medium ${abgelaufen ? "" : "text-brand-700 hover:text-brand-800"}`}>
                          {formatDatum(local.dateKey)}
                        </Link>
                        {weekdayOfDateKey(local.dateKey) === 7 && <span className="ml-1 text-xs">So</span>}
                        {v.serieId && (
                          <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                            Serie
                          </span>
                        )}
                      </td>
                      <td className="td whitespace-nowrap">
                        {timeFromMinutes(local.minuteOfDay)}–{timeFromMinutes(local.minuteOfDay + v.dauerMinuten)}
                      </td>
                      <td className="td">{raum?.name ?? "(Raum archiviert)"}</td>
                      <td className="td">
                        {mieter?.name ?? "(Mieter gelöscht)"}
                        {mieter && !mieter.active && (
                          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">archiviert</span>
                        )}
                      </td>
                      <td className="td tabular-nums">{chf(Number(v.preisChf))}</td>
                      <td className="td">
                        <VermietungsStatusBadge status={v.status} />
                      </td>
                      <td className="td">
                        {rechnung ? (
                          <Link
                            href={`/rechnungen/${rechnung.id}`}
                            className="font-mono text-xs text-brand-700 hover:text-brand-800"
                          >
                            {rechnung.nummer}
                          </Link>
                        ) : v.status === "ABGESAGT" ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <span className="text-xs text-slate-500">ausstehend</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Vergangene Termine sind blass dargestellt. Abgesagte Vermietungen erscheinen im Planer ausgegraut und
          sind überbuchbar.
        </p>
      </section>
    </div>
  );
}
