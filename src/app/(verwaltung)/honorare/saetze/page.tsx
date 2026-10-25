import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageHonorare, canManageStammdaten, canViewHonorare } from "@/lib/auth/permissions";
import { formatChf } from "@/lib/honorare/logik";
import { ladeDefaultStundensatz, ladeSaetze } from "@/lib/honorare/abrechnung";
import { DefaultSatzForm, HonorarSatzForm, HonorarSatzLoeschen } from "@/components/honorare/HonorarFormen";

export const metadata: Metadata = {
  title: "Honorar-Matrix",
};

/**
 * Honorar-Matrix (Modul 11): globaler Default-Stundensatz (Stammdaten — nur
 * Admin) + Abweichungen pro Lehrperson × Kursart × Lektionsdauer.
 */
export default function HonorarSaetzePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <SaetzeContent />
    </Suspense>
  );
}

async function SaetzeContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewHonorare(roles)) {
    return (
      <div className="card p-5 text-sm text-slate-600">
        Die Honorarabrechnung ist Admin, Chef und Büro vorbehalten.
      </div>
    );
  }

  const [defaultSatz, saetzeLadung, lehrpersonen, kursarten, dauern] = await Promise.all([
    ladeDefaultStundensatz(),
    ladeSaetze(),
    db.orm.public.Person.where({ istLehrperson: true }).orderBy((p) => p.nachname.asc()).all(),
    db.orm.public.Kursart.where((k) => k.archivedAt.isNull()).orderBy((k) => k.sortOrder.asc()).all(),
    db.orm.public.Lektionsdauer.where((d) => d.archivedAt.isNull()).orderBy((d) => d.minuten.asc()).all(),
  ]);

  const canManage = canManageHonorare(roles);
  const canManageDefault = canManageStammdaten(roles);

  // Matrix nach Lehrperson gruppieren.
  const nachLehrperson = new Map<string, typeof saetzeLadung.roh>();
  for (const satz of saetzeLadung.roh) {
    const liste = nachLehrperson.get(satz.lehrpersonId) ?? [];
    liste.push(satz);
    nachLehrperson.set(satz.lehrpersonId, liste);
  }

  const lehrpersonOptionen = lehrpersonen.map((p) => ({
    id: p.id,
    name: `${p.vorname} ${p.nachname}${p.kuerzel ? ` (${p.kuerzel})` : ""}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Honorar-Matrix</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Stundensätze je Lehrperson × Kursart × Lektionsdauer; ohne Abweichung gilt der
            Default-Stundensatz, die Dauer wird hochgerechnet.
          </p>
        </div>
        <Link href="/honorare" className="btn-secondary px-3 py-1.5 text-sm">
          ← Monats-Workflow
        </Link>
      </div>

      {/* Globaler Default-Stundensatz (Stammdaten — nur Admin). */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Globaler Default-Stundensatz</h2>
        <p className="mt-0.5 mb-3 text-xs text-slate-500">
          Vorbelegung für alle Lektionen ohne individuelle Abweichung (Pflichtenheft: «fallen alle
          denselben Stundensatz, genügt ein Wert»).
        </p>
        <DefaultSatzForm
          stundensatz={defaultSatz !== null ? defaultSatz.toFixed(2) : ""}
          canManage={canManageDefault}
        />
      </section>

      {/* Neue Abweichung erfassen. */}
      {canManage && lehrpersonOptionen.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Abweichung setzen</h2>
          <HonorarSatzForm
            lehrpersonen={lehrpersonOptionen}
            kursarten={kursarten.map((k) => ({ id: k.id, name: k.name }))}
            dauern={dauern.map((d) => d.minuten)}
          />
        </section>
      )}

      {/* Gespeicherte Abweichungen. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Abweichungen pro Lehrperson ({saetzeLadung.roh.length})
        </h2>
        {saetzeLadung.roh.length === 0 ? (
          <div className="card p-5 text-sm text-slate-500">
            Noch keine Abweichungen gepflegt — alle Lektionen rechnen mit dem Default-Stundensatz ab.
          </div>
        ) : (
          [...nachLehrperson.entries()].map(([lehrpersonId, saetze]) => {
            const name = saetze[0]?.lehrpersonName ?? "Lehrperson";
            const kuerzel = saetze[0]?.kuerzel;
            return (
              <div key={lehrpersonId} className="card overflow-hidden">
                <header className="border-b border-line px-5 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {name}
                    {kuerzel ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                        {kuerzel}
                      </span>
                    ) : null}
                  </h3>
                </header>
                <table className="w-full text-sm">
                  <tbody>
                    {saetze.map((satz) => (
                      <tr key={satz.id} className="border-t border-line/60 first:border-t-0">
                        <td className="px-5 py-2">{satz.kursartName}</td>
                        <td className="px-3 py-2 tabular-nums">{satz.minuten} Min</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          CHF {formatChf(satz.stundensatz)} / h
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">
                          ≈ CHF {formatChf((satz.stundensatz * satz.minuten) / 60)} je Lektion
                        </td>
                        <td className="px-5 py-2 text-right">
                          {canManage && <HonorarSatzLoeschen satzId={satz.id} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
