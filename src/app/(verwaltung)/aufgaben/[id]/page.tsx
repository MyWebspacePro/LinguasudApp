import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, fromDbTime, roleList, AUFGABE_QUELLE_LABELS } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnfragen, isStaff } from "@/lib/auth/permissions";
import { formatDatum } from "@/lib/zeit";
import { AufgabeFormular, AufgabeAktionen } from "@/components/aufgaben/AufgabenFormen";

export const metadata: Metadata = {
  title: "Aufgabe",
};

/** Aufgaben-Detail (Modul 13): bearbeiten, erledigen/wieder öffnen, löschen. */
export default async function AufgabeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AufgabeDetailContent id={id} />
    </Suspense>
  );
}

async function AufgabeDetailContent({ id }: { id: string }) {
  const { user } = await requireStaff();
  if (!canManageAnfragen(roleList(user.roles))) redirect("/dashboard");

  const aufgabe = await db.orm.public.Aufgabe.where({ id }).first();
  if (!aufgabe) notFound();

  const [userRows, personRows, kursRows] = await Promise.all([
    db.orm.public.User.where({ isActive: true }).all(),
    db.orm.public.Person.orderBy((p) => p.nachname.asc()).all(),
    db.orm.public.Kurs.orderBy((k) => k.code.asc()).all(),
  ]);

  const stabsPersonen = userRows
    .filter((u) => isStaff(roleList(u.roles)))
    .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const personen = personRows.map((p) => ({
    id: p.id,
    label: `${p.vorname} ${p.nachname}${p.status === "INTERESSENT" ? " (Interessent/in)" : ""}`,
  }));
  const kurse = kursRows.map((k) => ({ id: k.id, label: k.code }));

  const assignee = aufgabe.assigneeUserId ? userRows.find((u) => u.id === aufgabe.assigneeUserId) : null;
  const verknuepftePerson = aufgabe.personId ? personRows.find((p) => p.id === aufgabe.personId) : null;
  const verknuepfterKurs = aufgabe.kursId ? kursRows.find((k) => k.id === aufgabe.kursId) : null;
  const verknuepfteAnfrage = aufgabe.anfrageId
    ? (await db.orm.public.Anfrage.where({ id: aufgabe.anfrageId }).first())
    : null;
  const faelligKey = aufgabe.faelligAm ? String(aufgabe.faelligAm).slice(0, 10) : null;
  const erledigtAm = aufgabe.erledigtAt ? fromDbTime(aufgabe.erledigtAt) : null;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href="/aufgaben" className="text-sm text-slate-600 transition hover:text-brand-700">
          ← Aufgaben
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{aufgabe.titel}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {aufgabe.status === "OFFEN" ? "Offen" : `Erledigt${erledigtAm ? ` am ${erledigtAm.toLocaleDateString("de-CH")}` : ""}`}
          {aufgabe.erledigtVonName ? ` · von ${aufgabe.erledigtVonName}` : ""} ·{" "}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {AUFGABE_QUELLE_LABELS[aufgabe.quelle] ?? aufgabe.quelle}
          </span>
          {aufgabe.dedupKey && <span className="ml-1 text-xs text-slate-400">(Automatik)</span>}
        </p>
      </div>

      <div className="card space-y-1.5 p-5 text-sm">
        <p>
          <span className="text-slate-500">Fälligkeit:</span>{" "}
          {faelligKey ? formatDatum(faelligKey) : "—"}
        </p>
        <p>
          <span className="text-slate-500">Zugewiesen:</span>{" "}
          {assignee ? `${assignee.firstName} ${assignee.lastName}` : "unbeauftragt (Büro)"}
        </p>
        <p>
          <span className="text-slate-500">Verknüpft:</span>{" "}
          {verknuepfteAnfrage && (
            <Link href={`/anfragen/${verknuepfteAnfrage.id}`} className="text-brand-700 hover:text-brand-800">
              Anfrage von {verknuepfteAnfrage.name}
            </Link>
          )}
          {verknuepftePerson && (
            <Link href={`/personen/${verknuepftePerson.id}`} className="text-brand-700 hover:text-brand-800">
              {verknuepftePerson.vorname} {verknuepftePerson.nachname}
            </Link>
          )}
          {verknuepfterKurs && (
            <Link href={`/kurse/${verknuepfterKurs.id}`} className="text-brand-700 hover:text-brand-800">
              Kurs {verknuepfterKurs.code}
            </Link>
          )}
          {!verknuepfteAnfrage && !verknuepftePerson && !verknuepfterKurs && "—"}
        </p>
        {aufgabe.beschreibung && (
          <p className="whitespace-pre-line pt-1 text-slate-700">{aufgabe.beschreibung}</p>
        )}
      </div>

      <div className="card p-5">
        <AufgabeAktionen aufgabeId={aufgabe.id} status={aufgabe.status} titel={aufgabe.titel} />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Bearbeiten</h2>
        <AufgabeFormular
          stabsPersonen={stabsPersonen}
          personen={personen}
          kurse={kurse}
          aufgabe={{
            id: aufgabe.id,
            titel: aufgabe.titel,
            beschreibung: aufgabe.beschreibung,
            assigneeUserId: aufgabe.assigneeUserId,
            faelligAm: faelligKey,
            personId: aufgabe.personId,
            kursId: aufgabe.kursId,
          }}
        />
      </div>
    </div>
  );
}
