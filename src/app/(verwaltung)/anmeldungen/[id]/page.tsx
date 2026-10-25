import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { ANREDE_LABELS, BILLING_TYP_LABELS, JOURNAL_ART_LABELS } from "@/lib/domain";
import {
  guthabenStand,
  paketendeErreicht,
  paketendeSchwelle,
  paketFortschritt,
  verbrauchtImPaket,
  type JournalEintrag,
} from "@/lib/anmeldungen/paket";
import { AnmeldungStatusBadge } from "@/components/anmeldungen/AnmeldungBadges";
import { GuthabenAktionen, PaketEndeAktionen, ProbeZuAktivButton } from "@/components/anmeldungen/AnmeldungAktionen";

export const metadata: Metadata = {
  title: "Anmeldung",
};

/** Anmeldung-Detail (Modul 5): Paket, Guthaben-Konto mit Journal, Paketende-Automatik. */
export default function AnmeldungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AnmeldungDetailContent params={params} />
    </Suspense>
  );
}

async function AnmeldungDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canManageAnmeldungen(roles)) {
    redirect("/dashboard");
  }

  const anmeldung = await db.orm.public.Anmeldung
    .where({ id })
    .include("person")
    .include("kurs")
    .include("kostentraeger")
    .include("rechnungsempfaenger")
    .include("tarifstufe")
    .first();
  if (!anmeldung) notFound();

  const journalRows = await db.orm.public.GuthabenJournal
    .where({ anmeldungId: id })
    .orderBy((j) => j.datum.desc())
    .all();
  const journal: JournalEintrag[] = journalRows.map((j) => ({
    art: j.art,
    delta: j.delta,
    datum: String(j.datum),
  }));

  const verbraucht = verbrauchtImPaket(journal, String(anmeldung.paketStartAt));
  const guthaben = guthabenStand(journal);
  const schwelle = paketendeSchwelle(anmeldung.paketGroesse);
  const paketende = paketendeErreicht(verbraucht, anmeldung.paketGroesse);
  const fortschritt = paketFortschritt(verbraucht, anmeldung.paketGroesse);
  const aktiv = anmeldung.status === "AKTIV";

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/anmeldungen" className="text-sm text-brand-700 hover:text-brand-800">
          ← Anmeldungen
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {ANREDE_LABELS[anmeldung.person.anrede]} {anmeldung.person.vorname} {anmeldung.person.nachname}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              in{" "}
              <Link href={`/kurse/${anmeldung.kursId}`} className="font-mono font-medium text-brand-700 hover:text-brand-800">
                {anmeldung.kurs.code}
              </Link>{" "}
              ·{" "}
              <Link href={`/personen/${anmeldung.personId}`} className="text-slate-500 hover:text-brand-700">
                Kartei öffnen →
              </Link>
            </p>
          </div>
          <AnmeldungStatusBadge status={anmeldung.status} />
        </div>
      </div>

      {/* ——— Überblick ——— */}
      <section className="card grid gap-x-8 gap-y-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Billing-Typ">
          {BILLING_TYP_LABELS[anmeldung.billingTyp]}
          {anmeldung.kostentraeger ? (
            <span className="block text-xs text-slate-500">
              {anmeldung.kostentraeger.name} ({anmeldung.kostentraeger.kundennummer})
            </span>
          ) : null}
        </Info>
        <Info label="Rechnungsempfänger">
          {anmeldung.rechnungsempfaenger
            ? `${anmeldung.rechnungsempfaenger.vorname} ${anmeldung.rechnungsempfaenger.nachname} (abweichend)`
            : "Anmeldung selbst"}
        </Info>
        <Info label="Tarifstufe">
          {anmeldung.tarifstufe.name}
          {anmeldung.tarifUebersteuert && <HinweisBadge text="übersteuert" />}
        </Info>
        <Info label="Paketgrösse">
          {anmeldung.paketGroesse} Lektionen
          {anmeldung.paketGroesseUebersteuert && <HinweisBadge text="übersteuert" />}
        </Info>
        <Info label="Preis / Paket">
          {Number(anmeldung.preisChf).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF
          {anmeldung.preisUebersteuert && <HinweisBadge text="übersteuert" />}
          {anmeldung.preisAbweichungGrund && (
            <span className="block text-xs text-slate-500">Abweichung: {anmeldung.preisAbweichungGrund}</span>
          )}
        </Info>
        <Info label="Angemeldet seit">
          {fromDbTime(anmeldung.createdAt).toLocaleDateString("de-CH")}
        </Info>
        {anmeldung.notizen && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Info label="Notizen">{anmeldung.notizen}</Info>
          </div>
        )}
      </section>

      {/* ——— Probe → fest ——— */}
      {anmeldung.status === "PROBE" && (
        <section className="card border-sky-200 bg-sky-50/50 p-5">
          <h2 className="text-sm font-semibold text-sky-900">Probelektion</h2>
          <p className="mb-3 mt-0.5 text-xs text-sky-800">
            Kein Guthaben, kein Preis — erscheint in der Anwesenheitsliste. Bei fester Anmeldung wird das
            Paket-Guthaben ({anmeldung.paketGroesse} Lektionen) aufgeladen.
          </p>
          <ProbeZuAktivButton anmeldungId={anmeldung.id} />
        </section>
      )}

      {/* ——— Paket ——— */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Laufendes Paket</h2>
          <span className="text-xs text-slate-500">
            seit {fromDbTime(anmeldung.paketStartAt).toLocaleDateString("de-CH")}
          </span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">
              {verbraucht} / {anmeldung.paketGroesse} Lektionen verbraucht
            </span>
            <span className={guthaben <= 0 ? "font-semibold text-red-700" : "text-slate-600"}>
              Guthaben: {guthaben}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${paketende ? "bg-amber-500" : "bg-brand-600"}`}
              style={{ width: `${Math.round(fortschritt * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Automatik meldet nach der {schwelle}. von {anmeldung.paketGroesse} Lektion
            {anmeldung.paketGroesse === 1 ? "" : "en"} («fortfahren oder beenden?»).
            {anmeldung.paketEndeGemeldetAt
              ? ` Zuletzt informiert: ${fromDbTime(anmeldung.paketEndeGemeldetAt).toLocaleString("de-CH")}.`
              : ""}
          </p>
        </div>
        {aktiv && (
          <div className="mt-4 border-t border-line pt-4">
            <PaketEndeAktionen
              anmeldungId={anmeldung.id}
              schwelleErreicht={paketende}
              gemeldet={Boolean(anmeldung.paketEndeGemeldetAt)}
            />
          </div>
        )}
      </section>

      {/* ——— Guthaben-Konto ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Guthaben-Konto pflegen</h2>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">
          Aufladungen, Korrekturen (begründet) und Fehlzeiten — das Büro entscheidet unentschuldigt
          (−1) / entschuldigt (−0) final. Der Lektions-Verbrauch wird ab Modul 7 beim Anwesenheits-Abschluss gebucht.
        </p>
        <GuthabenAktionen anmeldungId={anmeldung.id} aktiv={aktiv} />
      </section>

      {/* ——— Journal ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Journal</h2>
        {journalRows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Datum</th>
                  <th className="th">Art</th>
                  <th className="th">Δ Lektionen</th>
                  <th className="th">Bemerkung</th>
                  <th className="th">Erfasst von</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {journalRows.map((j) => (
                  <tr key={j.id}>
                    <td className="td whitespace-nowrap">{fromDbTime(j.datum).toLocaleString("de-CH")}</td>
                    <td className="td">{JOURNAL_ART_LABELS[j.art]}</td>
                    <td className={`td font-semibold ${j.delta < 0 ? "text-red-700" : j.delta > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                      {j.delta > 0 ? `+${j.delta}` : String(j.delta)}
                    </td>
                    <td className="td text-slate-600">{j.bemerkung ?? "—"}</td>
                    <td className="td text-xs text-slate-500">{j.actorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Noch keine Journal-Einträge{anmeldung.status === "PROBE" ? " (Probe-Anmeldung ohne Guthaben)" : ""}.
          </p>
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

function HinweisBadge({ text }: { text: string }) {
  return (
    <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">{text}</span>
  );
}
