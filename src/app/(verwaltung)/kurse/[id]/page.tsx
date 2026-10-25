import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime, toDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageKurse, canViewKurse, hasRole } from "@/lib/auth/permissions";
import { ANREDE_LABELS, ANMELDUNG_STATUS_LABELS } from "@/lib/domain";
import { dateKeyOf, formatDatum, timeFromMinutes, utcToZoned } from "@/lib/zeit";
import { loadKursOptionen } from "@/lib/kurse/optionen";
import { KursForm } from "@/components/kurse/KursForm";
import {
  KursDeletePanel,
  KursStatusBadge,
  KursStatusForm,
  NiveauWechselForm,
  UnterbrechungenPanel,
} from "@/components/kurse/KursAktionen";

export const metadata: Metadata = {
  title: "Kurs",
};

/** Kurs-Detail (Modul 4): Stammdaten, Niveau-Verlauf, Unterbrechungen, Anmeldungen, Lektionen. */
export default function KursDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KursDetailContent params={params} />
    </Suspense>
  );
}

async function KursDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewKurse(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManageKurse(roles);

  const kurs = await db.orm.public.Kurs
    .where({ id })
    .include("sprache")
    .include("niveau")
    .include("kursart")
    .include("lehrperson")
    .include("standardRaum")
    .include("kostentraeger")
    .first();
  if (!kurs) notFound();

  // Lehrpersonen sehen nur ihre eigenen Kurse.
  const istEigeneLehrperson = !canManage && hasRole(roles, "LEHRPERSON") && actor.personId === kurs.lehrpersonId;
  if (!canManage && !istEigeneLehrperson) {
    redirect("/kurse");
  }

  const jetzt = toDbTime(new Date());
  const [verlauf, unterbrechungen, lektionen, anmeldungen, etage, standort, optionen] = await Promise.all([
    db.orm.public.KursNiveauVerlauf.where({ kursId: id }).orderBy((v) => v.von.asc()).all(),
    db.orm.public.KursUnterbrechung.where({ kursId: id }).orderBy((u) => u.von.asc()).all(),
    db.orm.public.Lektion
      .where({ kursId: id })
      .where((l) => l.startAt.gte(jetzt))
      .orderBy((l) => l.startAt.asc())
      .limit(10)
      .include("raum")
      .all(),
    db.orm.public.Anmeldung
      .where({ kursId: id })
      .where((a) => a.status.in(["PROBE", "AKTIV"]))
      .orderBy((a) => a.createdAt.asc())
      .include("person")
      .all(),
    kurs.standardRaum ? db.orm.public.Etage.where({ id: kurs.standardRaum.etageId }).first() : Promise.resolve(null),
    kurs.standardRaum ? etageFuer(kurs.standardRaum.etageId) : Promise.resolve(null),
    canManage ? loadKursOptionen() : Promise.resolve(null),
  ]);

  const niveaus = optionen?.niveaus ?? [];
  const niveauById = new Map(niveaus.map((n) => [n.id, n]));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/kurse" className="text-sm text-brand-700 hover:text-brand-800">
          ← Kurse
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-semibold text-slate-900">{kurs.code}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {kurs.sprache.name} · Niveau {kurs.niveau.code} · {kurs.kursart.name}
              {kurs.lehrperson ? ` · ${kurs.lehrperson.vorname} ${kurs.lehrperson.nachname}` : " · Lehrperson offen"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <KursStatusBadge status={kurs.status} />
            {canManage && <KursStatusForm kursId={kurs.id} status={kurs.status} />}
          </div>
        </div>
      </div>

      {/* ——— Stammdaten ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Stammdaten</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Wochentermin">
            {kurs.wochentag && kurs.startZeit && kurs.dauerMinuten
              ? `${wochentagName(kurs.wochentag)} ${kurs.startZeit} · ${kurs.dauerMinuten} Min.`
              : "kein Fixtermin (keine automatische Generierung)"}
          </Info>
          <Info label="Kursort">
            {kurs.extern
              ? `extern — ${kurs.externOrt ?? "ohne Adresse"} (nicht im Raumplaner)`
              : kurs.standardRaum
                ? `${standort?.name ?? "—"} · ${etage?.name ?? "—"} · Raum ${kurs.standardRaum.name}`
                : "Schule — ohne festen Raum"}
          </Info>
          <Info label="Teilnehmende max.">
            {kurs.maxParticipants ?? "Kursart-Standard"}
          </Info>
          <Info label="Kostenträger">
            {kurs.kostentraeger ? `${kurs.kostentraeger.name} (${kurs.kostentraeger.kundennummer})` : "—"}
          </Info>
          <Info label="Anmeldungen">
            {anmeldungen.filter((a) => a.status === "AKTIV").length} aktiv ·{" "}
            {anmeldungen.filter((a) => a.status === "PROBE").length} Probe
          </Info>
          <Info label="Notizen">{kurs.notizen ?? "—"}</Info>
        </dl>
        {canManage && optionen && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">Bearbeiten</summary>
            <div className="mt-4">
              <KursForm
                kurs={{
                  id: kurs.id,
                  code: kurs.code,
                  niveauId: kurs.niveauId,
                  niveauCode: kurs.niveau.code,
                  spracheId: kurs.spracheId,
                  kursartId: kurs.kursartId,
                  lehrpersonId: kurs.lehrpersonId,
                  wochentag: kurs.wochentag,
                  startZeit: kurs.startZeit,
                  dauerMinuten: kurs.dauerMinuten,
                  extern: kurs.extern,
                  externOrt: kurs.externOrt,
                  standardRaumId: kurs.standardRaumId,
                  maxParticipants: kurs.maxParticipants,
                  kostentraegerId: kurs.kostentraegerId,
                  notizen: kurs.notizen,
                }}
                optionen={optionen}
              />
            </div>
          </details>
        )}
      </section>

      {/* ——— Niveau-Verlauf ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Niveau-Verlauf</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Zeiträume pro Niveau; ein Wechsel passt den Kurscode an und löst die Kursbestätigung aus (Modul 10).
        </p>
        {verlauf.length > 0 ? (
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Niveau</th>
                <th className="th">Von</th>
                <th className="th">Bis</th>
                <th className="th">Quelle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {verlauf.map((v) => (
                <tr key={v.id} className={v.bis === null ? "font-medium" : "text-slate-500"}>
                  <td className="td font-semibold">{niveauById.get(v.niveauId)?.code ?? v.niveauId}</td>
                  <td className="td">{formatDatum(datumVonDb(v.von))}</td>
                  <td className="td">{v.bis ? formatDatum(datumVonDb(v.bis)) : "—"}</td>
                  <td className="td text-xs">
                    {v.gemeldetVonLehrperson ? "von Lehrperson gemeldet" : "Büro"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Kein Verlauf erfasst.</p>
        )}
        <div className="mt-4">
          <NiveauWechselForm
            kursId={kurs.id}
            niveaus={niveaus}
            alsLehrperson={istEigeneLehrperson}
          />
        </div>
      </section>

      {/* ——— Unterbrechungen ——— */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Unterbrechungen</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Kurse in Unterbrechung erscheinen im Planer ausgegraut; ihr Slot ist für andere Kurse überbuchbar.
        </p>
        <div className="mt-3">
          <UnterbrechungenPanel kursId={kurs.id} unterbrechungen={unterbrechungen} canManage={canManage} />
        </div>
      </section>

      {/* ——— Anmeldungen ——— */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Anmeldungen</h2>
          {canManage && (
            <Link href={`/anmeldungen/neu?kurs=${kurs.id}`} className="btn-secondary px-3 py-1.5 text-xs">
              Anmeldung erfassen
            </Link>
          )}
        </div>
        {anmeldungen.length > 0 ? (
          <ul className="mt-2 divide-y divide-line text-sm">
            {anmeldungen.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Link href={`/anmeldungen/${a.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                    {ANREDE_LABELS[a.person.anrede]} {a.person.vorname} {a.person.nachname}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">{ANMELDUNG_STATUS_LABELS[a.status]}</span>
                </span>
                <Link href={`/personen/${a.personId}`} className="text-xs text-slate-500 hover:text-brand-700">
                  Kartei öffnen →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Noch keine Anmeldungen.</p>
        )}
      </section>

      {/* ——— Kommende Lektionen ——— */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Kommende Lektionen (nächste 10)</h2>
          <Link href="/planer" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Raumplaner →
          </Link>
        </div>
        {lektionen.length > 0 ? (
          <ul className="mt-2 divide-y divide-line text-sm">
            {lektionen.map((l) => {
              const local = utcToZoned(fromDbTime(l.startAt));
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{formatDatum(local.dateKey)}</span>
                  <span className="text-slate-600">
                    {timeFromMinutes(local.minuteOfDay)} – {timeFromMinutes(local.minuteOfDay + l.dauerMinuten)}
                  </span>
                  <span className="text-slate-600">{l.raum ? `Raum ${l.raum.name}` : kurs.extern ? "extern" : "ohne Raum"}</span>
                  <LektionStatusHinweis status={l.status} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Keine kommenden Lektionen — die rollierende Generierung legt 2 Wochen im Voraus an (nächtlich oder per Planer-Button).
          </p>
        )}
      </section>

      {/* ——— Löschen ——— */}
      {canManage && (
        <section className="card border-red-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800">Kurs löschen</h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">
            Nur möglich ohne Anmeldungen und Lektionen — sonst bitte Status «abgesagt»/«abgeschlossen» setzen.
          </p>
          <KursDeletePanel kursId={kurs.id} code={kurs.code} />
        </section>
      )}
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

function LektionStatusHinweis({ status }: { status: string }) {
  if (status === "FIXIERT") return <span className="text-xs font-semibold text-emerald-700">fixiert</span>;
  if (status === "ABGESAGT") return <span className="text-xs font-semibold text-red-700">abgesagt</span>;
  return <span className="text-xs text-slate-500">provisorisch</span>;
}

function wochentagName(n: number): string {
  return ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][n - 1] ?? "—";
}

/** UTC-Mitternachts-Konvention reiner Datumsfelder → dateKey. */
function datumVonDb(s: string): string {
  return dateKeyOf(fromDbTime(s));
}

async function etageFuer(etageId: string) {
  const etage = await db.orm.public.Etage.where({ id: etageId }).first();
  if (!etage) return null;
  return db.orm.public.Standort.where({ id: etage.standortId }).first();
}
