import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, fromDbTime, roleList, type AnfrageStatus } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnfragen } from "@/lib/auth/permissions";
import { dateKeyOf, formatDatum } from "@/lib/zeit";
import { AnfrageStatusBadge } from "@/components/anfragen/AnfragenBadges";
import {
  AnfrageStatusAktionen,
  AnfrageZuordnung,
  AnfrageZuordnungAufheben,
} from "@/components/anfragen/AnfragenFormen";

export const metadata: Metadata = {
  title: "Anfrage",
};

/**
 * Anfrage-Detail (Modul 13): Kontakt-Snapshot, Test-Ergebnis, Statuswechsel
 * und Zuordnung nach Identitätsprüfung (bestehende Person oder neue
 * INTERESSENT-Person). Alles im Audit-Log (anfrage.*).
 */
export default async function AnfrageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <AnfrageDetailContent id={id} />
    </Suspense>
  );
}

async function AnfrageDetailContent({ id }: { id: string }) {
  const { user } = await requireStaff();
  const rollen = roleList(user.roles);
  if (!canManageAnfragen(rollen)) redirect("/dashboard");

  const anfrage = await db.orm.public.Anfrage.where({ id }).first();
  if (!anfrage) notFound();

  const [personRows, spracheRows, niveauRows] = await Promise.all([
    db.orm.public.Person.orderBy((p) => p.nachname.asc()).all(),
    db.orm.public.Sprache.where({ active: true }).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Niveau.where({ active: true }).orderBy((n) => n.sortOrder.asc()).all(),
  ]);

  const sprache = anfrage.spracheId ? spracheRows.find((s) => s.id === anfrage.spracheId) : null;
  const niveau = anfrage.niveauId ? niveauRows.find((n) => n.id === anfrage.niveauId) : null;
  const empfohlen = anfrage.empfohlenesNiveauId ? niveauRows.find((n) => n.id === anfrage.empfohlenesNiveauId) : null;
  const person = anfrage.personId ? personRows.find((p) => p.id === anfrage.personId) : null;

  // Test-Rohresultat (Json) defensiv lesen — nur für die Anzeige.
  const testResultat = anfrage.testResultat as { proNiveau?: { code: string; richtig: number; total: number }[] } | null;
  const bestaetigtLabel =
    anfrage.bestaetigtAm === null
      ? "—"
      : anfrage.bestaetigtVia === "email"
        ? "E-Mail gesendet"
        : anfrage.bestaetigtVia === "devlog"
          ? "Dev-Log (kein SMTP)"
          : "Fehler — bitte nachfassen";

  // Heuristik für den Namen der neuen INTERESSENT-Person: letzter Token =
  // Nachname (Vorschlag, das Büro bestätigt/ändert beim Anlegen).
  const tokens = anfrage.name.trim().split(/\s+/);
  const nameVorschlag =
    tokens.length >= 2
      ? { vorname: tokens.slice(0, -1).join(" "), nachname: tokens[tokens.length - 1] ?? "" }
      : { vorname: "", nachname: anfrage.name.trim() };

  const eingang = fromDbTime(anfrage.createdAt);
  const zugeordnetAm = anfrage.zugeordnetAt ? fromDbTime(anfrage.zugeordnetAt) : null;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/anfragen" className="text-sm text-slate-600 transition hover:text-brand-700">
            ← Anfragen
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Anfrage von {anfrage.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            Eingang {formatDatum(dateKeyOf(eingang))} {eingang.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} ·{" "}
            <AnfrageStatusBadge status={anfrage.status} />
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-1.5 p-5 text-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Kontakt</h2>
          <p>
            <span className="text-slate-500">Name:</span> {anfrage.name}
          </p>
          <p>
            <span className="text-slate-500">E-Mail:</span>{" "}
            <a href={`mailto:${anfrage.email}`} className="text-brand-700 hover:text-brand-800">
              {anfrage.email}
            </a>
          </p>
          {anfrage.telefon && (
            <p>
              <span className="text-slate-500">Telefon:</span> {anfrage.telefon}
            </p>
          )}
          <p>
            <span className="text-slate-500">Bestätigung:</span> {bestaetigtLabel}
          </p>
          {anfrage.nachricht && (
            <p className="whitespace-pre-line pt-1 text-slate-700">{anfrage.nachricht}</p>
          )}
        </div>

        <div className="card space-y-1.5 p-5 text-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Sprache &amp; Einstufung</h2>
          <p>
            <span className="text-slate-500">Gewünschte Sprache:</span> {sprache?.name ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Gewünschtes Niveau:</span> {niveau?.code ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Empfehlung (Test):</span>{" "}
            {empfohlen ? (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                {empfohlen.code}
              </span>
            ) : (
              "—"
            )}
          </p>
          {testResultat?.proNiveau && testResultat.proNiveau.length > 0 && (
            <table className="mt-2 w-full max-w-48 text-xs">
              <tbody className="divide-y divide-line">
                {testResultat.proNiveau.map((e) => (
                  <tr key={e.code}>
                    <td className="py-1 text-slate-600">{e.code}</td>
                    <td className="py-1 text-right tabular-nums text-slate-600">
                      {e.richtig}/{e.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Bearbeiten</h2>
        {anfrage.status === "ZUGEORDNET" ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-slate-500">Zugeordnet:</span>{" "}
              {person ? (
                <Link href={`/personen/${person.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                  {person.vorname} {person.nachname}
                </Link>
              ) : (
                <span className="text-slate-500">(Person gelöscht)</span>
              )}
              {zugeordnetAm && (
                <span className="text-slate-500">
                  {" "}
                  · {formatDatum(dateKeyOf(zugeordnetAm))}
                  {anfrage.zugeordnetVonName ? ` · durch ${anfrage.zugeordnetVonName}` : ""}
                </span>
              )}
            </p>
            <AnfrageZuordnungAufheben anfrageId={anfrage.id} />
          </div>
        ) : (
          <div className="space-y-5">
            <AnfrageStatusAktionen anfrageId={anfrage.id} status={anfrage.status as AnfrageStatus} />
            <div className="border-t border-line pt-4">
              <AnfrageZuordnung
                anfrageId={anfrage.id}
                personen={personRows.map((p) => ({
                  id: p.id,
                  label: `${p.nachname} ${p.vorname} · ${p.status === "INTERESSENT" ? "Interessent/in" : p.status === "AKTIV" ? "aktiv" : "inaktiv"}`,
                }))}
                nameVorschlag={nameVorschlag}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
