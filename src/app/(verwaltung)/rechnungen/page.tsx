import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { heuteDateKey, formatDatum } from "@/lib/zeit";
import { istUeberfaellig, restbetrag, type RechnungStatus } from "@/lib/rechnungen/logik";
import { RechnungsStatusBadge, UeberfaelligBadge } from "@/components/rechnungen/RechnungsBadges";

export const metadata: Metadata = {
  title: "Rechnungen",
};

/** Rechnungsliste (Modul 9) — nur Admin/Chef/Büro. */
export default function RechnungenPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <RechnungenContent />
    </Suspense>
  );
}

async function RechnungenContent() {
  const { user } = await requireStaff();
  if (!canManageAnmeldungen(user.roles as Role[])) redirect("/dashboard");

  const rechnungen = await db.orm.public.Rechnung.orderBy((r) => r.nummer.desc()).limit(200).all();
  const rechnungIds = rechnungen.map((r) => r.id);
  const zahlungen = rechnungIds.length
    ? await db.orm.public.Zahlung.where((z) => z.rechnungId.in(rechnungIds)).all()
    : [];

  const bezahltProRechnung = new Map<string, number>();
  for (const z of zahlungen) {
    bezahltProRechnung.set(z.rechnungId, (bezahltProRechnung.get(z.rechnungId) ?? 0) + Number(z.betragChf));
  }
  const heute = heuteDateKey();
  const chf = (wert: number) => wert.toLocaleString("de-CH", { minimumFractionDigits: 2 });

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rechnungen</h1>
          <p className="mt-1 text-sm text-slate-600">
            Schweizer QR-Rechnung · Teilzahlungen &amp; Restbeträge · Mahn-Stufen automatisch
          </p>
        </div>
        <Link href="/rechnungen/neu" className="btn-primary">
          Neue Rechnung
        </Link>
      </div>

      {rechnungen.length === 0 ? (
        <div className="card p-6 text-sm text-slate-600">
          Noch keine Rechnungen. Rechnungen entstehen automatisch bei fester Anmeldung bzw.
          Paket-Verlängerung (privat/Firma) — Behörden-Rechnungen und Zusatzpositionen erfasst
          das Büro über «Neue Rechnung».
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Nummer</th>
                <th className="th">Empfänger</th>
                <th className="th">Rechnungsdatum</th>
                <th className="th">Fällig am</th>
                <th className="th">Total</th>
                <th className="th">Restbetrag</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rechnungen.map((r) => {
                const bezahlt = bezahltProRechnung.get(r.id) ?? 0;
                const rest = restbetrag(
                  String(r.totalChf),
                  zahlungen.filter((z) => z.rechnungId === r.id).map((z) => String(z.betragChf)),
                );
                const faelligKey = String(r.faelligAm).slice(0, 10);
                const ueberfaellig = istUeberfaellig(r.status as RechnungStatus, faelligKey, heute);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <Link href={`/rechnungen/${r.id}`} className="font-mono font-medium text-brand-700 hover:text-brand-800">
                        {r.nummer}
                      </Link>
                    </td>
                    <td className="td">{r.empfaengerName}</td>
                    <td className="td whitespace-nowrap">{formatDatum(String(r.rechnungsdatum).slice(0, 10))}</td>
                    <td className="td whitespace-nowrap">{formatDatum(faelligKey)}</td>
                    <td className="td tabular-nums">{chf(Number(r.totalChf))}</td>
                    <td className={`td tabular-nums ${ueberfaellig ? "font-semibold text-red-700" : ""}`}>
                      {Number(rest) <= 0 ? "—" : chf(Number(rest))}
                      {bezahlt > 0 && Number(rest) > 0 && (
                        <span className="block text-xs text-slate-500">bezahlt: {chf(bezahlt)}</span>
                      )}
                    </td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <RechnungsStatusBadge status={r.status as RechnungStatus} />
                        {ueberfaellig && <UeberfaelligBadge />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        «Überfällig» wird aus Fälligkeit und Zahlungseingängen abgeleitet und nicht gespeichert;
        Mahn-Stufen 1 (Erinnerung) und 2 (Mahnung) versendet der Mahn-Job automatisch per E-Mail.
      </p>
    </div>
  );
}
