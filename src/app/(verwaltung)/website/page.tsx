import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { fromDbTime } from "@/lib/db";
import { timeFromMinutes, utcToZoned } from "@/lib/zeit";

export const metadata: Metadata = {
  title: "Website",
};

const TYP_LABEL: Record<string, string> = {
  START: "Startseite",
  SPRACHE: "Sprachseite",
  SEITE: "Seite",
};

/** CMS der öffentlichen Website (Modul 15): Büro/Chef pflegen Seiten und Pop-up. */
export default function WebsitePage() {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <WebsiteContent />
    </Suspense>
  );
}

/** DB-DateTime (UTC-String) → datetime-local-Wert in Schul-Lokalzeit. */
function dbZuDatetimeLocal(dbZeit: string | Date | null): string {
  if (!dbZeit) return "";
  const instant = fromDbTime(String(dbZeit));
  const teile = utcToZoned(instant);
  return `${teile.dateKey}T${timeFromMinutes(teile.minuteOfDay)}`;
}

async function WebsiteContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManageWebsite(roles)) {
    redirect("/dashboard");
  }

  const [seiten, popups] = await Promise.all([
    db.orm.public.WebsiteSeite
      .orderBy((s) => s.navSortOrder.asc())
      .select("id", "slug", "typ", "inNavigation", "imFuss", "active")
      .include("uebersetzungen")
      .all(),
    db.orm.public.WebsitePopup.orderBy((p) => p.createdAt.desc()).all(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Website (CMS)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Seiten, Übersetzungen (DE/EN) und Pop-up der öffentlichen Website — ohne Programmieren.
          </p>
        </div>
        <Link href="/website/seite/neu" className="btn-primary">
          Neue Seite
        </Link>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="th">Typ</th>
              <th className="th">Pfad</th>
              <th className="th">Titel (DE)</th>
              <th className="th">EN</th>
              <th className="th">Nav</th>
              <th className="th">Fuss</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {seiten.map((seite) => {
              const de = seite.uebersetzungen.find((u) => u.locale === "DE");
              const en = seite.uebersetzungen.find((u) => u.locale === "EN");
              return (
                <tr key={seite.id} className="border-b border-line last:border-0">
                  <td className="td">{TYP_LABEL[seite.typ] ?? seite.typ}</td>
                  <td className="td font-mono text-xs">{seite.typ === "START" ? "/" : `/${seite.slug}`}</td>
                  <td className="td">{de?.titel ?? "—"}</td>
                  <td className="td">
                    {en ? <span className="text-emerald-700">✓</span> : <span className="text-slate-400">Falls-back DE</span>}
                  </td>
                  <td className="td">{seite.inNavigation ? "✓" : ""}</td>
                  <td className="td">{seite.imFuss ? "✓" : ""}</td>
                  <td className="td">
                    {seite.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">aktiv</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">inaktiv</span>
                    )}
                  </td>
                  <td className="td text-right">
                    <Link href={`/website/seite/${seite.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Pop-up</h2>
            <p className="mt-1 text-sm text-slate-600">
              Angezeigt wird das aktive Pop-up mit passendem Zeitfenster; «Schliessen» versteckt es für einen Tag.
            </p>
          </div>
          <Link href="/website/popup/neu" className="btn-secondary">
            Neues Pop-up
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {popups.map((popup) => (
            <div key={popup.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{popup.titel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {popup.aktiv ? "aktiv" : "inaktiv"}
                    {popup.gueltigVon ? ` · von ${dbZuDatetimeLocal(popup.gueltigVon).replace("T", " ")}` : ""}
                    {popup.gueltigBis ? ` · bis ${dbZuDatetimeLocal(popup.gueltigBis).replace("T", " ")}` : ""}
                  </p>
                </div>
                <Link href={`/website/popup/${popup.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Bearbeiten
                </Link>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{popup.text}</p>
            </div>
          ))}
          {popups.length === 0 && <p className="text-sm text-slate-600">Noch kein Pop-up angelegt.</p>}
        </div>
      </section>
    </div>
  );
}
