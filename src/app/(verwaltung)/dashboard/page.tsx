import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { db, fromDbTime, toDbTime, type Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import {
  canManageBueroplan,
  canViewAuditLog,
  canViewAnmeldungen,
  canViewKurse,
  canViewPersonen,
  canViewPlaner,
  canViewUsers,
  hasRole,
} from "@/lib/auth/permissions";
import { zonedTimeToUtc, addDays, dateKeyOf, heuteDateKey, formatDatumKurz, timeFromMinutes, utcToZoned, weekdayOfDateKey } from "@/lib/zeit";
import { istUeberfaellig, type RechnungStatus } from "@/lib/rechnungen/logik";
import { monatLabel as honorarMonatLabel } from "@/lib/honorare/logik";
import { ladeMonatsAbrechnung } from "@/lib/honorare/abrechnung";
import { ladeVermietungsMonat } from "@/lib/vermietung/daten";
import { RoleBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Übersicht",
};

/** Verwaltungs-Übersicht — wächst mit den kommenden Modulen. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  const [userCount, personCount, recentLogins, kursCount, anmeldungAktivCount, lektionenHeute, rechnungsZaehler, honorarAuswertung, vermietungsAuswertung] = await Promise.all([
    canViewUsers(roles)
      ? db.orm.public.User.aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewPersonen(roles)
      ? db.orm.public.Person.aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewAuditLog(roles)
      ? db.orm.public.AuditLog
          .where((e) => e.action.in(["user.login", "user.login_failed"]))
          .orderBy((e) => e.createdAt.desc())
          .limit(5)
          .all()
      : Promise.resolve(null),
    canViewKurse(roles)
      ? db.orm.public.Kurs.where({ status: "AKTIV" }).aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewKurse(roles)
      ? db.orm.public.Anmeldung.where({ status: "AKTIV" }).aggregate((a) => ({ n: a.count() })).then((r) => r.n)
      : Promise.resolve(null),
    canViewPlaner(roles) && weekdayOfDateKey(heuteDateKey()) !== 7
      ? (async () => {
          const start = zonedTimeToUtc(heuteDateKey(), "00:00");
          const ende = zonedTimeToUtc(addDays(heuteDateKey(), 1), "00:00");
          const rows = await db.orm.public.Lektion
            .where((l) => l.startAt.gte(toDbTime(start)))
            .where((l) => l.startAt.lt(toDbTime(ende)))
            .include("kurs")
            .all();
          return rows.filter((l) => !l.kurs.extern && l.status !== "ABGESAGT").length;
        })()
      : Promise.resolve(null),
    canViewAnmeldungen(roles)
      ? (async () => {
          const offen = await db.orm.public.Rechnung
            .where((r) => r.status.in(["VERSENDET", "TEILBEZAHLT"]))
            .all();
          const heute = heuteDateKey();
          const ueberfaellig = offen.filter(
            (r) => istUeberfaellig(r.status as RechnungStatus, String(r.faelligAm).slice(0, 10), heute),
          ).length;
          return { offen: offen.length, ueberfaellig };
        })()
      : Promise.resolve(null),
    hasRole(roles, "ADMIN") || hasRole(roles, "CHEF")
      ? (async () => {
          // Modul 11 — Honorar-Totals des laufenden Monats (bezahlte über den
          // Snapshot, offene aus der live gerechneten Lektionsliste).
          const monat = heuteDateKey().slice(0, 7);
          const { gruppen } = await ladeMonatsAbrechnung(monat);
          let offenChf = 0;
          let bezahltChf = 0;
          let offenLehrpersonen = 0;
          for (const { monat: gruppe, abrechnung } of gruppen) {
            if (abrechnung?.status === "BEZAHLT") {
              bezahltChf += abrechnung.totalChf;
            } else {
              offenChf += gruppe.totalChf;
              if (gruppe.zeilen.length > 0) offenLehrpersonen += 1;
            }
          }
          return {
            monatLabel: honorarMonatLabel(monat),
            offenChf: Math.round(offenChf * 100) / 100,
            bezahltChf: Math.round(bezahltChf * 100) / 100,
            offenLehrpersonen,
          };
        })()
      : Promise.resolve(null),
    hasRole(roles, "ADMIN") || hasRole(roles, "CHEF")
      ? (async () => {
          // Modul 12 — Vermietungs-Umsatz des laufenden Monats (offen/bezahlt
          // aus den Vermietungs-Rechnungen, Muster Honorar-Karte).
          return await ladeVermietungsMonat(heuteDateKey().slice(0, 7));
        })()
      : Promise.resolve(null),
  ]);
  const offeneRechnungen = rechnungsZaehler?.offen ?? 0;
  const ueberfaelligeRechnungen = rechnungsZaehler?.ueberfaellig ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Guten Tag, {user.firstName} {user.lastName}
        </h1>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canViewKurse(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kurse</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{kursCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              aktive fortlaufende Kurse ·{" "}
              <Link href="/kurse" className="font-medium text-brand-700 hover:text-brand-800">
                Kursliste
              </Link>
              {hasRole(roles, "ADMIN") || hasRole(roles, "BUERO") || hasRole(roles, "CHEF") ? (
                <>
                  {" · "}
                  <Link href="/kurse/neu" className="font-medium text-brand-700 hover:text-brand-800">
                    Neuer Kurs
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        )}

        {canViewKurse(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Anmeldungen</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{anmeldungAktivCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              aktive Pakete (Guthaben-Konto) ·{" "}
              <Link href="/anmeldungen" className="font-medium text-brand-700 hover:text-brand-800">
                Anmeldungen
              </Link>
            </p>
          </div>
        )}

        {canViewPlaner(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Lektionen heute</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{lektionenHeute}</p>
            <p className="mt-1 text-sm text-slate-600">
              <Link href="/planer" className="font-medium text-brand-700 hover:text-brand-800">
                Raumplaner öffnen →
              </Link>
            </p>
          </div>
        )}

        {canViewPersonen(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Personen-Kartei
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{personCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              <Link href="/personen" className="font-medium text-brand-700 hover:text-brand-800">
                Kartei öffnen
              </Link>
              {hasRole(roles, "ADMIN") || hasRole(roles, "BUERO") || hasRole(roles, "CHEF") ? (
                <>
                  {" · "}
                  <Link href="/personen/neu" className="font-medium text-brand-700 hover:text-brand-800">
                    Neue Person
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        )}

        {canManageBueroplan(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Büroplanung</p>
            <p className="mt-1 text-sm text-slate-600">
              Dienst-Pensen, Abweichungen, Urlaub &amp; Krankheit der Büropersonen.
            </p>
            <p className="mt-2 text-sm">
              <Link href="/bueroplan" className="font-medium text-brand-700 hover:text-brand-800">
                Büroplan öffnen →
              </Link>
            </p>
          </div>
        )}

        {canViewAnmeldungen(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Rechnungen</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{offeneRechnungen}</p>
            <p className="mt-1 text-sm text-slate-600">
              offen (versendet / teilbezahlt), {ueberfaelligeRechnungen} überfällig ·{" "}
              <Link href="/rechnungen" className="font-medium text-brand-700 hover:text-brand-800">
                Rechnungsliste
              </Link>
            </p>
          </div>
        )}

        {/* Modul 11 — Finanz-Auswertung des Chefs: Honorar-Totals des laufenden Monats. */}
        {honorarAuswertung && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Honorare {honorarAuswertung.monatLabel}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {honorarAuswertung.offenChf.toFixed(2)} CHF
            </p>
            <p className="mt-1 text-sm text-slate-600">
              offen ({honorarAuswertung.offenLehrpersonen} Lehrpersonen), bezahlt{" "}
              {honorarAuswertung.bezahltChf.toFixed(2)} CHF ·{" "}
              <Link href="/honorare" className="font-medium text-brand-700 hover:text-brand-800">
                Honorarabrechnung
              </Link>
            </p>
          </div>
        )}

        {/* Modul 12 — Finanz-Auswertung des Chefs: Vermietungs-Umsatz des laufenden Monats. */}
        {vermietungsAuswertung && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Vermietung {honorarMonatLabel(heuteDateKey().slice(0, 7))}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {vermietungsAuswertung.umsatzChf.toFixed(2)} CHF
            </p>
            <p className="mt-1 text-sm text-slate-600">
              offen {vermietungsAuswertung.offenChf.toFixed(2)} CHF · bezahlt{" "}
              {vermietungsAuswertung.bezahltChf.toFixed(2)} CHF · {vermietungsAuswertung.termine} Termin
              {vermietungsAuswertung.termine === 1 ? "" : "e"}
              {vermietungsAuswertung.ohneRechnung > 0
                ? `, ${vermietungsAuswertung.ohneRechnung} ohne Rechnung`
                : ""}{" "}
              ·{" "}
              <Link href="/vermietungen" className="font-medium text-brand-700 hover:text-brand-800">
                Vermietung
              </Link>
            </p>
          </div>
        )}

        {canViewUsers(roles) && (
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Konten</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{userCount}</p>
            <p className="mt-1 text-sm text-slate-600">
              {hasRole(roles, "ADMIN") || hasRole(roles, "BUERO") ? (
                <>
                  <Link href="/benutzer/neu" className="font-medium text-brand-700 hover:text-brand-800">
                    Neues Konto anlegen
                  </Link>
                  {" · "}
                </>
              ) : null}
              <Link href="/benutzer" className="font-medium text-brand-700 hover:text-brand-800">
                Benutzerliste
              </Link>
            </p>
          </div>
        )}

        {canViewAuditLog(roles) && (
          <div className="card p-5 sm:col-span-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Letzte Anmelde-Ereignisse
            </p>
            {recentLogins && recentLogins.length > 0 ? (
              <ul className="mt-2 divide-y divide-line text-sm">
                {recentLogins.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-slate-700">{entry.summary}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {fromDbTime(entry.createdAt).toLocaleString("de-CH")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Noch keine Ereignisse.</p>
            )}
            <p className="mt-2 text-sm">
              <Link href="/audit" className="font-medium text-brand-700 hover:text-brand-800">
                Vollständiges Audit-Log →
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Nächste Ausbaustufen</h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <li>Modul 13+ — Aufgaben &amp; Anfragen, KI-Generator, Website</li>
        </ul>
      </div>

      <OffeneAnwesenheiten user={user} roles={roles} />
    </div>
  );
}

/**
 * Offene Anwesenheiten (Modul 7): beendete, noch nicht abgeschlossene
 * Lektionen — Büro sieht alle, Lehrpersonen ihre eigenen (Erinnerung läuft
 * zusätzlich automatisch am nächsten Tag per E-Mail).
 */
async function OffeneAnwesenheiten({ user, roles }: { user: { personId: string | null }; roles: Role[] }) {
  if (!canViewPlaner(roles)) return null;
  const bueroSicht = canViewAnmeldungen(roles);
  const eigenePersonId = bueroSicht ? null : (user.personId ?? "__keine__");

  const untergrenze = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
  const jetzt = new Date();
  let query = db.orm.public.Lektion
    .where((l) => l.status.in(["PROVISORISCH", "FIXIERT"]))
    .where((l) => l.startAt.gte(toDbTime(untergrenze)))
    .where((l) => l.startAt.lt(toDbTime(jetzt)))
    .include("kurs")
    .include("lehrperson");
  if (eigenePersonId) query = query.where((l) => l.lehrpersonId.eq(eigenePersonId));
  const offene = await query.orderBy((l) => l.startAt.desc()).limit(10).all();
  if (offene.length === 0) return null;

  // Erfassungsfortschritt: aktive Anmeldungen je Kurs, Anwesenheiten je Lektion.
  const kursIds = [...new Set(offene.map((l) => l.kursId))];
  const lektionIds = offene.map((l) => l.id);
  const [anmeldungen, erfasst] = await Promise.all([
    db.orm.public.Anmeldung
      .where((a) => a.kursId.in(kursIds))
      .where((a) => a.status.eq("AKTIV"))
      .all(),
    db.orm.public.Anwesenheit.where((a) => a.lektionId.in(lektionIds)).all(),
  ]);
  const aktivProKurs = new Map<string, number>();
  for (const a of anmeldungen) {
    aktivProKurs.set(a.kursId, (aktivProKurs.get(a.kursId) ?? 0) + 1);
  }
  const erfasstProLektion = new Map<string, number>();
  for (const e of erfasst) {
    erfasstProLektion.set(e.lektionId, (erfasstProLektion.get(e.lektionId) ?? 0) + 1);
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">
        Offene Anwesenheiten {bueroSicht ? "(alle Lehrpersonen)" : "(eigene Lektionen)"}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Beendete Lektionen ohne Abschluss — Lehrpersonen haben 24 h, danach korrigiert das Büro.
        Erinnerung geht automatisch am nächsten Tag per E-Mail.
      </p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {offene.map((l) => {
          const aktiv = aktivProKurs.get(l.kursId) ?? 0;
          const erfasstCount = erfasstProLektion.get(l.id) ?? 0;
          const local = utcToZoned(fromDbTime(l.startAt));
          const tag = dateKeyOf(fromDbTime(l.startAt));
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium text-slate-800">{l.kurs.code}</span>
                <span className="ml-2 text-slate-500">
                  {formatDatumKurz(tag)} · {timeFromMinutes(local.minuteOfDay)}
                </span>
                {l.lehrperson && <span className="ml-2 text-slate-500">· {l.lehrperson.vorname} {l.lehrperson.nachname}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className={`text-xs ${erfasstCount >= aktiv ? "text-emerald-700" : "text-amber-700"}`}>
                  {erfasstCount}/{aktiv} erfasst
                </span>
                <Link href={`/planer?tag=${tag}`} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                  Im Planer erfassen →
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
