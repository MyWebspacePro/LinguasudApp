import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { formatDatum, heuteDateKey } from "@/lib/zeit";
import {
  istUeberfaellig,
  mahnStufeLabel,
  naechsteMahnStufe,
  restbetrag,
  type RechnungStatus,
} from "@/lib/rechnungen/logik";
import { RechnungsStatusBadge, UeberfaelligBadge } from "@/components/rechnungen/RechnungsBadges";
import { versendeRechnungAction } from "@/lib/rechnungen/actions";
import {
  EntwurfBearbeitenForm,
  EntwurfLoeschForm,
  MahnungForm,
  RechnungAktionForm,
  StornoForm,
  ZahlungForm,
} from "@/components/rechnungen/RechnungsFormen";

export const metadata: Metadata = {
  title: "Rechnung",
};

/** Rechnungs-Detail (Modul 9): Positionen, Zahlungen, Mahn-Stufen, Aktionen. */
export default function RechnungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <RechnungDetailContent params={params} />
    </Suspense>
  );
}

async function RechnungDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManageAnmeldungen(roles)) redirect("/dashboard");

  const rechnung = await db.orm.public.Rechnung.where({ id }).first();
  if (!rechnung) notFound();

  const [positionen, zahlungen, mahnungen] = await Promise.all([
    db.orm.public.RechnungsPosition.where({ rechnungId: id }).orderBy((p) => p.reihenfolge.asc()).all(),
    db.orm.public.Zahlung.where({ rechnungId: id }).orderBy((z) => z.datum.asc()).all(),
    db.orm.public.Mahnung.where({ rechnungId: id }).orderBy((m) => m.stufe.asc()).all(),
  ]);

  const status = rechnung.status as RechnungStatus;
  const faelligKey = String(rechnung.faelligAm).slice(0, 10);
  const ueberfaellig = istUeberfaellig(status, faelligKey, heuteDateKey());
  const total = String(rechnung.totalChf);
  const rest = restbetrag(
    total,
    zahlungen.map((z) => String(z.betragChf)),
  );
  const bezahltChf = (Number(total) - Number(rest)).toFixed(2);
  const chf = (wert: number) => wert.toLocaleString("de-CH", { minimumFractionDigits: 2 });
  const entwurf = status === "ENTWURF";
  const offen = status === "VERSENDET" || status === "TEILBEZAHLT";
  const naechsteStufe = naechsteMahnStufe(status, rechnung.mahnStufe, faelligKey, heuteDateKey());

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/rechnungen" className="text-sm text-brand-700 hover:text-brand-800">
          ← Rechnungen
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Rechnung {rechnung.nummer}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {rechnung.empfaengerName}
              {(rechnung.empfaengerStrasse || rechnung.empfaengerPlz || rechnung.empfaengerOrt) && (
                <>
                  {" · "}
                  {[rechnung.empfaengerStrasse, `${rechnung.empfaengerPlz} ${rechnung.empfaengerOrt}`.trim()].filter(Boolean).join(", ")}
                </>
              )}
              {rechnung.anmeldungId && (
                <>
                  {" · "}
                  <Link href={`/anmeldungen/${rechnung.anmeldungId}`} className="text-slate-500 hover:text-brand-700">
                    zur Anmeldung →
                  </Link>
                </>
              )}
            </p>
          </div>
          <span className="flex items-center gap-1.5">
            <RechnungsStatusBadge status={status} />
            {ueberfaellig && <UeberfaelligBadge />}
          </span>
        </div>
      </div>

      {/* ——— Aktionen ——— */}
      <section className="card flex flex-wrap items-center gap-3 p-4">
        <a href={`/rechnungen/${id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
          PDF öffnen (QR-Zahlteil)
        </a>
        {entwurf && (
          <>
            <RechnungAktionForm
              action={versendeRechnungAction}
              fields={{ rechnungId: id }}
              label="Versenden"
              confirmText="Rechnung jetzt versenden (Status → versendet, PDF per E-Mail falls vorhanden)?"
              className="btn-primary"
            />
            <EntwurfLoeschForm rechnungId={id} />
          </>
        )}
        {offen && <ZahlungForm rechnungId={id} restbetragChf={rest} />}
        {offen && (
          <MahnungForm rechnungId={id} naechsteStufe={rechnung.mahnStufe < 1 ? 1 : 2} />
        )}
        {status !== "STORNIERT" && status !== "BEZAHLT" && <StornoForm rechnungId={id} />}
      </section>

      {/* ——— Überblick ——— */}
      <section className="card grid gap-x-8 gap-y-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Rechnungsdatum">{formatDatum(String(rechnung.rechnungsdatum).slice(0, 10))}</Info>
        <Info label="Zahlbar bis">
          {formatDatum(faelligKey)}
          {ueberfaellig && <span className="ml-2 text-xs font-semibold text-red-700">überfällig</span>}
        </Info>
        <Info label="MwSt">
          {rechnung.mwstSatzProzent === null ? "MwSt-frei" : `${Number(rechnung.mwstSatzProzent).toLocaleString("de-CH")} %`}
        </Info>
        <Info label="Total">{chf(Number(total))} CHF</Info>
        <Info label="Bezahlt">{chf(Number(bezahltChf))} CHF</Info>
        <Info label="Restbetrag">
          <span className={Number(rest) > 0 && !entwurf && !ueberfaellig ? "font-semibold" : Number(rest) > 0 && ueberfaellig ? "font-semibold text-red-700" : ""}>
            {chf(Number(rest))} CHF
          </span>
        </Info>
        <Info label="QR-Referenznummer">
          <span className="font-mono text-xs">{rechnung.referenzNr}</span>
        </Info>
        <Info label="Mahnwesen">
          {mahnStufeLabel(rechnung.mahnStufe)}
          {rechnung.letzteMahnAt && (
            <span className="block text-xs text-slate-500">
              zuletzt: {fromDbTime(rechnung.letzteMahnAt).toLocaleString("de-CH")}
              {naechsteStufe ? ` · Stufe ${naechsteStufe} fällig am ${formatDatum(faelligKey)}` : ""}
            </span>
          )}
        </Info>
        <Info label="Empfänger-E-Mail">{rechnung.empfaengerEmail ?? "—"}</Info>
        {rechnung.notiz && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Info label="Notiz">{rechnung.notiz}</Info>
          </div>
        )}
        {rechnung.storniertGrund && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Info label="Storno-Grund">{rechnung.storniertGrund}</Info>
          </div>
        )}
      </section>

      {/* ——— Positionen / Entwurf bearbeiten ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Positionen</h2>
        {entwurf ? (
          <div className="mt-3">
            <p className="mb-2 text-xs text-slate-500">
              Entwurf bearbeiten — beim Speichern wird das Total und die Fälligkeit neu berechnet.
            </p>
            <EntwurfBearbeitenForm
              rechnungId={id}
              positionen={positionen.map((p) => ({ text: p.text, menge: String(p.menge), preis: String(p.einzelpreisChf) }))}
              mwstSatzProzent={rechnung.mwstSatzProzent === null ? null : Number(rechnung.mwstSatzProzent)}
              notiz={rechnung.notiz}
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Text</th>
                  <th className="th">Anzahl</th>
                  <th className="th">Einzelpreis</th>
                  <th className="th">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {positionen.map((p) => (
                  <tr key={p.id}>
                    <td className="td">{p.text}</td>
                    <td className="td tabular-nums">{p.menge}</td>
                    <td className="td tabular-nums">{chf(Number(p.einzelpreisChf))}</td>
                    <td className="td tabular-nums">{chf(Number(p.einzelpreisChf) * p.menge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ——— Zahlungen ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Zahlungen</h2>
        {zahlungen.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Datum</th>
                  <th className="th">Betrag</th>
                  <th className="th">Bemerkung</th>
                  <th className="th">Erfasst von</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {zahlungen.map((z) => (
                  <tr key={z.id}>
                    <td className="td whitespace-nowrap">{fromDbTime(z.datum).toLocaleDateString("de-CH")}</td>
                    <td className="td tabular-nums">{chf(Number(z.betragChf))}</td>
                    <td className="td text-slate-600">{z.bemerkung ?? "—"}</td>
                    <td className="td text-xs text-slate-500">{z.actorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Noch keine Zahlungen erfasst.</p>
        )}
      </section>

      {/* ——— Mahnungen ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Mahnungen</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Stufe 1 (freundliche Erinnerung) automatisch 10 Tage nach Fälligkeit, Stufe 2 (Mahnung)
          nach 30 Tagen — das Büro kann jederzeit früher auslösen.
        </p>
        {mahnungen.length > 0 ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {mahnungen.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  Stufe {m.stufe} — {m.stufe === 1 ? "freundliche Erinnerung" : "Mahnung"}
                  {m.fehler && <span className="ml-2 text-xs text-amber-700">({m.fehler})</span>}
                </span>
                <span className="text-xs text-slate-500">
                  {fromDbTime(m.versendetAt).toLocaleString("de-CH")} · {m.email}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Noch keine Mahnungen versendet.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}
