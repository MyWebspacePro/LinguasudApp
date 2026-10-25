import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { AnmeldungStatus, BillingTyp, Role } from "@/lib/db";
import { db, fromDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen, canViewAnmeldungen } from "@/lib/auth/permissions";
import { ANMELDUNG_STATUS_LABELS, ANMELDUNG_STATUS_WERTE, BILLING_TYP_LABELS, BILLING_TYP_WERTE } from "@/lib/domain";
import { guthabenStand, paketendeErreicht, verbrauchtImPaket, type JournalEintrag } from "@/lib/anmeldungen/paket";
import { AnmeldungStatusBadge } from "@/components/anmeldungen/AnmeldungBadges";

export const metadata: Metadata = {
  title: "Anmeldungen",
};

const PAGE_SIZE = 20;

/** Anmeldungen (Modul 5): Pakete, Guthaben, offene Paketentscheide. */
export default function AnmeldungenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AnmeldungenContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AnmeldungenContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewAnmeldungen(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManageAnmeldungen(roles);

  const params = searchParams ? await searchParams : {};
  const status = ANMELDUNG_STATUS_WERTE.includes(params.status as AnmeldungStatus)
    ? (params.status as AnmeldungStatus)
    : null;
  const billing = BILLING_TYP_WERTE.includes(params.billing as BillingTyp)
    ? (params.billing as BillingTyp)
    : null;
  const kursFilter = typeof params.kurs === "string" ? params.kurs : "";
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);

  let scoped = db.orm.public.Anmeldung;
  if (status) scoped = scoped.where({ status });
  if (billing) scoped = scoped.where({ billingTyp: billing });
  if (kursFilter) scoped = scoped.where({ kursId: kursFilter });

  const [anmeldungen, total] = await Promise.all([
    scoped
      .orderBy((a) => a.createdAt.desc())
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .include("person")
      .include("kurs")
      .include("kostentraeger")
      .all(),
    scoped.aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Journal-Einträge der angezeigten Anmeldungen in einem Query (Paketfortschritt).
  const ids = anmeldungen.map((a) => a.id);
  const journal = ids.length
    ? await db.orm.public.GuthabenJournal.where((j) => j.anmeldungId.in(ids)).all()
    : [];
  const journalByAnmeldung = new Map<string, JournalEintrag[]>();
  for (const j of journal) {
    const liste = journalByAnmeldung.get(j.anmeldungId) ?? [];
    liste.push({ art: j.art, delta: j.delta, datum: String(j.datum) });
    journalByAnmeldung.set(j.anmeldungId, liste);
  }

  const fortschritt = (a: (typeof anmeldungen)[number]) => {
    const eintraege = journalByAnmeldung.get(a.id) ?? [];
    const verbraucht = verbrauchtImPaket(eintraege, String(a.paketStartAt));
    const guthaben = guthabenStand(eintraege);
    return { verbraucht, guthaben, paketende: paketendeErreicht(verbraucht, a.paketGroesse) };
  };

  // Offene Paketentscheide: Automatik-Schwelle erreicht, noch aktiv, Entscheidung offen.
  const offeneEntscheide = anmeldungen
    .filter((a) => a.status === "AKTIV" && a.paketEntscheid === "OFFEN" && fortschritt(a).paketende)
    .slice(0, 6);

  const pageHref = (seite: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (billing) sp.set("billing", billing);
    if (kursFilter) sp.set("kurs", kursFilter);
    if (seite > 1) sp.set("seite", String(seite));
    const qs = sp.toString();
    return qs ? `/anmeldungen?${qs}` : "/anmeldungen";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Anmeldungen</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Pakete (14/15 Lektionen), Guthaben-Konto mit Journal, Billing privat / Firma / öffentliche Einrichtung.
          </p>
        </div>
        {canManage && (
          <Link href="/anmeldungen/neu" className="btn-primary">
            Neue Anmeldung
          </Link>
        )}
      </div>

      {offeneEntscheide.length > 0 && (
        <section className="card border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Offene Paketentscheide (Automatik 12./13. Lektion)</h2>
          <ul className="mt-2 divide-y divide-amber-200/60 text-sm">
            {offeneEntscheide.map((a) => {
              const f = fortschritt(a);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>
                    <span className="font-medium">
                      {a.person.vorname} {a.person.nachname}
                    </span>{" "}
                    <span className="text-slate-600">
                      in {a.kurs.code} · {f.verbraucht}/{a.paketGroesse} Lektionen
                    </span>
                  </span>
                  <Link href={`/anmeldungen/${a.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                    Entscheiden →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label htmlFor="filter-status" className="label">
            Status
          </label>
          <select id="filter-status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Alle</option>
            {ANMELDUNG_STATUS_WERTE.map((s) => (
              <option key={s} value={s}>
                {ANMELDUNG_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-billing" className="label">
            Billing-Typ
          </label>
          <select id="filter-billing" name="billing" defaultValue={billing ?? ""} className="input">
            <option value="">Alle</option>
            {BILLING_TYP_WERTE.map((b) => (
              <option key={b} value={b}>
                {BILLING_TYP_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtern
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-220">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Person</th>
              <th className="th">Kurs</th>
              <th className="th">Status</th>
              <th className="th">Billing</th>
              <th className="th">Paket</th>
              <th className="th">Guthaben</th>
              <th className="th">Preis</th>
              <th className="th">Seit</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {anmeldungen.map((a) => {
              const f = fortschritt(a);
              return (
                <tr key={a.id} className={a.status === "BEENDET" ? "text-slate-500" : ""}>
                  <td className="td font-medium">
                    <Link href={`/personen/${a.personId}`} className="hover:text-brand-700">
                      {a.person.vorname} {a.person.nachname}
                    </Link>
                  </td>
                  <td className="td font-mono text-xs">
                    <Link href={`/kurse/${a.kursId}`} className="hover:text-brand-700">
                      {a.kurs.code}
                    </Link>
                  </td>
                  <td className="td">
                    <AnmeldungStatusBadge status={a.status} />
                  </td>
                  <td className="td text-xs">
                    {BILLING_TYP_LABELS[a.billingTyp]}
                    {a.kostentraeger ? <span className="block text-slate-500">{a.kostentraeger.name}</span> : null}
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className={f.paketende && a.status === "AKTIV" ? "font-semibold text-amber-700" : ""}>
                      {f.verbraucht}/{a.paketGroesse}
                    </span>
                  </td>
                  <td className="td">
                    <span className={f.guthaben <= 0 && a.status === "AKTIV" ? "font-semibold text-red-700" : ""}>
                      {f.guthaben}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap">
                    {Number(a.preisChf).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF
                    {a.preisUebersteuert && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800" title={a.preisAbweichungGrund ?? ""}>
                        übersteuert
                      </span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">
                    {fromDbTime(a.createdAt).toLocaleDateString("de-CH")}
                  </td>
                  <td className="td text-right">
                    <Link href={`/anmeldungen/${a.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                      Öffnen
                    </Link>
                  </td>
                </tr>
              );
            })}
            {anmeldungen.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={9}>
                  Keine Anmeldungen gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} Anmeldung{total === 1 ? "" : "en"} · Seite {page} von {pageCount}
        </span>
        {pageCount > 1 && (
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="font-medium text-brand-700">
                ← Zurück
              </Link>
            )}
            {page < pageCount && (
              <Link href={pageHref(page + 1)} className="font-medium text-brand-700">
                Weiter →
              </Link>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
