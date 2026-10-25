import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db, fromDbTime, toDbTime } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManagePlaner, canViewPlaner, hasRole } from "@/lib/auth/permissions";
import { lehrpersonKonflikte, raumKonflikte, type PlanLektion } from "@/lib/kurse/konflikte";
import { planTage } from "@/lib/planer/raster";
import { addDays, formatDatumKurz, heuteDateKey, parseDateKey, utcToZoned, weekdayOfDateKey, zonedTimeToUtc } from "@/lib/zeit";
import { PlanerGrid, type AnwesenheitEintrag, type PlanerLektion, type PlanerSpalten } from "@/components/planer/PlanerGrid";
import { GenerierenButton } from "@/components/planer/GenerierenButton";
import { istFensterAbgelaufen } from "@/lib/anwesenheit/logik";

export const metadata: Metadata = {
  title: "Raumplaner",
};

/** Raumplaner (Modul 6): 14 Tage Mo–Sa, 06:30–23:00, Standort → Etage → Räume. */
export default function PlanerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <PlanerContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanerContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewPlaner(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManagePlaner(roles);
  const eigeneLehrpersonId = !canManage && hasRole(roles, "LEHRPERSON") ? actor.personId : null;

  const params = searchParams ? await searchParams : {};
  const heute = heuteDateKey();
  // Ohne Parameter: heute — am Sonntag den ersten Planertag (Montag).
  const fallbackTag = weekdayOfDateKey(heute) === 7 ? addDays(heute, 1) : heute;
  const tagParam = typeof params.tag === "string" && parseDateKey(params.tag) ? params.tag : fallbackTag;
  const istSonntag = weekdayOfDateKey(tagParam) === 7;

  const tagStart = zonedTimeToUtc(tagParam, "00:00");
  const tagEnde = zonedTimeToUtc(addDays(tagParam, 1), "00:00");

  // Spaltenstruktur: aktive Standorte → Etagen (sortOrder) → aktive Räume.
  const [standorte, etagen, raeume] = await Promise.all([
    db.orm.public.Standort.where({ active: true }).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Etage.all(),
    db.orm.public.Raum.where({ active: true }).all(),
  ]);
  const etageById = new Map(etagen.map((e) => [e.id, e]));
  const spalten: PlanerSpalten[] = standorte
    .map((s) => {
      const etagenDesStandorts = etagen
        .filter((e) => e.standortId === s.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((e) => ({
          etageName: e.name,
          raeume: raeume
            .filter((r) => r.etageId === e.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => ({ id: r.id, name: r.name })),
        }))
        .filter((e) => e.raeume.length > 0);
      return { standortId: s.id, standortName: s.name, etagen: etagenDesStandorts };
    })
    .filter((s) => s.etagen.length > 0);

  // Lektionen des Tags (externe Firmenkurse erscheinen nicht im Planer).
  const lektionenRows = await db.orm.public.Lektion
    .where((l) => l.startAt.gte(toDbTime(tagStart)))
    .where((l) => l.startAt.lt(toDbTime(tagEnde)))
    .include("kurs")
    .include("lehrperson")
    .include("raum")
    .all();

  // Kurs-Bezugsdaten per ID-Map (keine verschachtelten Includes).
  const [sprachenAlle, niveausAlle, kursartenAlle] = await Promise.all([
    db.orm.public.Sprache.all(),
    db.orm.public.Niveau.all(),
    db.orm.public.Kursart.all(),
  ]);
  const spracheById = new Map(sprachenAlle.map((s) => [s.id, s]));
  const niveauById = new Map(niveausAlle.map((n) => [n.id, n]));
  const kursartById = new Map(kursartenAlle.map((k) => [k.id, k]));

  const relevanteRows = lektionenRows.filter(
    (l) => !l.kurs.extern && (!eigeneLehrpersonId || l.lehrpersonId === eigeneLehrpersonId || l.kurs.lehrpersonId === eigeneLehrpersonId),
  );

  // Unterbrechungen der betroffenen Kurse am Tag (für Grau/überbuchbar).
  const kursIds = [...new Set(relevanteRows.map((l) => l.kursId))];
  const unterbrechungen = kursIds.length
    ? await db.orm.public.KursUnterbrechung
        .where((u) => u.kursId.in(kursIds))
        .where((u) => u.von.lte(toDbTime(new Date(`${tagParam}T00:00:00Z`))))
        .where((u) => u.bis.gte(toDbTime(new Date(`${tagParam}T00:00:00Z`))))
        .all()
    : [];
  const unterbrocheneKurse = new Set(unterbrechungen.map((u) => u.kursId));

  const planLektionen: PlanerLektion[] = relevanteRows.map((l) => {
    const local = utcToZoned(fromDbTime(l.startAt));
    const istMeineLektion =
      !canManage && eigeneLehrpersonId !== null && (l.lehrpersonId === eigeneLehrpersonId || l.kurs.lehrpersonId === eigeneLehrpersonId);
    return {
      id: l.id,
      kursId: l.kursId,
      kursCode: l.kurs.code,
      kursStatus: l.kurs.status,
      unterbrochen: unterbrocheneKurse.has(l.kursId),
      spracheName: spracheById.get(l.kurs.spracheId)?.name ?? "?",
      niveauCode: niveauById.get(l.kurs.niveauId)?.code ?? "?",
      kursartName: kursartById.get(l.kurs.kursartId)?.name ?? "?",
      lehrpersonName: l.lehrperson ? `${l.lehrperson.vorname} ${l.lehrperson.nachname}` : null,
      lehrKuerzel: l.lehrperson?.kuerzel ?? null,
      raumId: l.raumId,
      raumLabel: l.raum ? l.raum.name : null,
      startMinute: local.minuteOfDay,
      dauerMinuten: l.dauerMinuten,
      status: l.status,
      quelle: l.quelle,
      istMeineLektion,
    };
  });

  // Anwesenheit (Modul 7): Daten nur für beendete Lektionen (Ende vorbei,
  // nicht abgesagt) laden — Erfassung direkt nach der Lektion.
  const jetzt = new Date().getTime();
  const vergangeneIds = relevanteRows
    .filter(
      (l) =>
        l.status !== "ABGESAGT" &&
        fromDbTime(l.startAt).getTime() + l.dauerMinuten * 60_000 <= jetzt,
    )
    .map((l) => l.id);
  const [anwesenheiten, anmeldeRows] = vergangeneIds.length
    ? await Promise.all([
        db.orm.public.Anwesenheit.where((a) => a.lektionId.in(vergangeneIds)).all(),
        db.orm.public.Anmeldung
          .where((a) => a.kursId.in(kursIds))
          .where((a) => a.status.in(["AKTIV", "PROBE"]))
          .include("person")
          .all(),
      ])
    : [[], []];
  const anwesenheitByLektion = new Map<string, Map<string, (typeof anwesenheiten)[number]>>();
  for (const a of anwesenheiten) {
    const pro = anwesenheitByLektion.get(a.lektionId) ?? new Map();
    pro.set(a.anmeldungId, a);
    anwesenheitByLektion.set(a.lektionId, pro);
  }
  const anmeldungByLektion = new Map<string, (typeof anmeldeRows)[number][]>();
  for (const a of anmeldeRows) {
    const liste = anmeldungByLektion.get(a.kursId) ?? [];
    liste.push(a);
    anmeldungByLektion.set(a.kursId, liste);
  }

  for (const planLektion of planLektionen) {
    const row = relevanteRows.find((l) => l.id === planLektion.id)!;
    const endeDb = new Date(fromDbTime(row.startAt).getTime() + row.dauerMinuten * 60_000);
    // Anwesenheit nur bei beendeten, nicht abgesagten Lektionen (Erfassung direkt nach der Lektion).
    if (row.status === "ABGESAGT" || endeDb.getTime() > jetzt) continue;
    const fensterAbgelaufen = istFensterAbgelaufen(toDbTime(endeDb), jetzt);
    const eintraege: AnwesenheitEintrag[] = (anmeldungByLektion.get(row.kursId) ?? []).map((a) => {
      const erfasst = anwesenheitByLektion.get(row.id)?.get(a.id);
      return {
        anmeldungId: a.id,
        personName: `${a.person.vorname} ${a.person.nachname}`,
        probe: a.status === "PROBE",
        status: erfasst?.status ?? null,
        bemerkung: erfasst?.bemerkung ?? null,
        vonLehrperson: erfasst?.vonLehrperson ?? false,
      };
    });
    planLektion.anwesenheit = {
      kannErfassen: canManage || (planLektion.istMeineLektion && !fensterAbgelaufen),
      fensterAbgelaufen,
      eintraege,
    };
  }

  // Konflikte nur farblich (keine harte Blockade): pausierte/unterbrochene
  // Kurse sind überbuchbar und erzeugen keine Konflikte.
  const konfliktBasis: PlanLektion[] = planLektionen.map((l) => ({
    id: l.id,
    raumId: l.raumId,
    startMinute: l.startMinute,
    dauerMinuten: l.dauerMinuten,
    lehrpersonId: l.lehrKuerzel, // wird nur auf Gleichheit geprüft
    ueberbuchbar: l.kursStatus !== "AKTIV" && l.kursStatus !== "GEPLANT" ? true : l.unterbrochen,
  }));
  const konfliktIds = [...new Set([...raumKonflikte(konfliktBasis), ...lehrpersonKonflikte(konfliktBasis)])];

  const onlineSpalte = planLektionen.some((l) => l.raumId === null);

  // Raumliste fürs Verschieben (label Standort · Etage · Raum).
  const raumOptionen = standorte.flatMap((s) => {
    const etagenDesStandorts = etagen.filter((e) => e.standortId === s.id);
    return raeume
      .filter((r) => etagenDesStandorts.some((e) => e.id === r.etageId))
      .map((r) => {
        const e = etageById.get(r.etageId);
        return { id: r.id, label: `${s.name} · ${e?.name ?? "?"} · ${r.name}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));
  });

  const tage = planTage(heute);
  const kursCountHeute = planLektionen.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Raumplaner · {formatDatumKurz(tagParam)}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {kursCountHeute} Lektion{kursCountHeute === 1 ? "" : "en"} · 14-Tage-Horizont (Mo–Sa, 06:30–23:00) ·
            pausierte/unterbrochene Kurse ausgegraut + überbuchbar · Konflikte nur markiert, nie blockiert.
          </p>
        </div>
        {canManage && <GenerierenButton />}
      </div>

      {/* Tag-Streifen: 14 Tage Mo–Sa */}
      <nav className="card flex flex-wrap items-center gap-1 p-2" aria-label="Planertage">
        <Link
          href="/planer"
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        >
          Heute
        </Link>
        {tage.map((t) => {
          const sonntag = weekdayOfDateKey(t) === 7;
          if (sonntag) return null;
          return (
            <Link
              key={t}
              href={`/planer?tag=${t}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                t === tagParam ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              {formatDatumKurz(t)}
            </Link>
          );
        })}
      </nav>

      {istSonntag ? (
        <p className="card p-8 text-center text-sm text-slate-600">
          Sonntag — kein Unterricht (Planer Mo–Sa). Bitte einen anderen Tag wählen.
        </p>
      ) : (
        <>
          <PlanerGrid
            tag={tagParam}
            spalten={spalten}
            lektionen={planLektionen}
            konfliktIds={konfliktIds}
            onlineSpalte={onlineSpalte}
            canManage={canManage}
            optionen={{
              raeume: raumOptionen,
              heuteKey: heute,
            }}
          />
          <p className="text-xs text-slate-500">
            Legende:{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border border-brand-300 bg-brand-100 align-middle" /> provisorisch ·{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border border-brand-700 bg-brand-700 align-middle" /> fixiert ·{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border border-emerald-600 bg-emerald-600 align-middle" /> durchgeführt
            (Anwesenheit abgeschlossen) ·{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border border-slate-300 bg-slate-200 align-middle" /> pausiert/unterbrochen
            (überbuchbar) ·{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border border-red-200 bg-red-50 align-middle" /> abgesagt ·{" "}
            <span className="mx-1 inline-block h-3 w-6 rounded border-2 border-red-500 align-middle" /> Konflikt
          </p>
        </>
      )}
    </div>
  );
}
