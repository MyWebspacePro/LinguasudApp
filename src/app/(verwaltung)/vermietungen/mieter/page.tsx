import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canViewVermietung } from "@/lib/auth/permissions";
import { MieterAktionen, MieterFormular } from "@/components/vermietung/VermietungFormen";

export const metadata: Metadata = {
  title: "Mieterkartei",
};

/**
 * Mieterkartei (Modul 12): Name, Kontakt, Rechnungsadresse. Löschen nur
 * ohne Vermietungen/Serien/Rechnungen (sonst archivieren); alles im Audit.
 */
export default function MieterPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <MieterContent />
    </Suspense>
  );
}

async function MieterContent() {
  const { user } = await requireStaff();
  if (!canViewVermietung(user.roles as Role[])) redirect("/dashboard");

  const mieter = await db.orm.public.VermietungMieter.orderBy((m) => m.name.asc()).all();
  const mieterIds = mieter.map((m) => m.id);
  const [vermietungen, serien, rechnungen] = await Promise.all([
    db.orm.public.Vermietung.select("mieterId").all(),
    db.orm.public.VermietungSerie.select("mieterId").all(),
    mieterIds.length
      ? db.orm.public.Rechnung.where((r) => r.mieterId.in(mieterIds)).select("mieterId").all()
      : Promise.resolve([]),
  ]);
  const vermietungenProMieter = new Map<string, number>();
  for (const v of vermietungen) {
    vermietungenProMieter.set(v.mieterId, (vermietungenProMieter.get(v.mieterId) ?? 0) + 1);
  }
  const serienProMieter = new Map<string, number>();
  for (const s of serien) {
    serienProMieter.set(s.mieterId, (serienProMieter.get(s.mieterId) ?? 0) + 1);
  }
  const rechnungenProMieter = new Map<string, number>();
  for (const r of rechnungen) {
    if (r.mieterId) rechnungenProMieter.set(r.mieterId, (rechnungenProMieter.get(r.mieterId) ?? 0) + 1);
  }

  const sortiert = [...mieter].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "de-CH"),
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mieterkartei</h1>
        <p className="mt-1 text-sm text-slate-600">
          Eigene Kartei für Raummiete — unabhängig von Personen- und Kostenträger-Kartei. Die
          Rechnungsadresse wird beim Erstellen der Vermietungs-Rechnung als Empfänger-Snapshot eingefroren.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Neuer Mieter</h2>
        <MieterFormular />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Kartei ({mieter.filter((m) => m.active).length} aktiv, {mieter.filter((m) => !m.active).length} archiviert)
        </h2>
        {sortiert.length === 0 ? (
          <div className="card p-6 text-sm text-slate-600">Noch keine Mieter erfasst.</div>
        ) : (
          <ul className="space-y-2">
            {sortiert.map((m) => {
              const anzahlVermietungen = vermietungenProMieter.get(m.id) ?? 0;
              const anzahlSerien = serienProMieter.get(m.id) ?? 0;
              const anzahlRechnungen = rechnungenProMieter.get(m.id) ?? 0;
              return (
                <li key={m.id} className="card p-4">
                  <details>
                    <summary className="cursor-pointer list-none">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${m.active ? "text-slate-800" : "text-slate-400"}`}>
                          {m.name}
                        </span>
                        {!m.active && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">archiviert</span>
                        )}
                        <span className="text-xs text-slate-500">
                          {anzahlVermietungen} Vermietungen · {anzahlSerien} Serien · {anzahlRechnungen} Rechnungen
                        </span>
                        <span className="ml-auto text-xs font-medium text-brand-700">bearbeiten ▾</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {m.strasse}, {m.plz} {m.ort}
                        {m.email ? ` · ${m.email}` : ""}
                        {m.telefon ? ` · ${m.telefon}` : ""}
                      </span>
                    </summary>
                    <div className="mt-4 space-y-4 border-t border-line pt-4">
                      <MieterFormular
                        mieter={{
                          id: m.id,
                          name: m.name,
                          email: m.email,
                          telefon: m.telefon,
                          strasse: m.strasse,
                          plz: m.plz,
                          ort: m.ort,
                          notiz: m.notiz,
                        }}
                      />
                      <MieterAktionen
                        mieter={{
                          id: m.id,
                          name: m.name,
                          email: m.email,
                          telefon: m.telefon,
                          strasse: m.strasse,
                          plz: m.plz,
                          ort: m.ort,
                          notiz: m.notiz,
                          active: m.active,
                        }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
