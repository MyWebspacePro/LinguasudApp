import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { SeiteForm, SeiteLoeschenButton, type SeiteDaten } from "@/components/website/WebsiteFormen";

export const metadata: Metadata = {
  title: "Seite bearbeiten",
};

// params-Zugriff: bewusst blockierend (Session-Guard im Suspense).
export const instant = false;

/** CMS-Seiteneditor (Modul 15): DE Pflicht, EN optional, SEO-Felder. */
export default async function SeiteEditorPage({
  params,
}: {
  params?: Promise<{ id?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <EditorContent id={(await params)?.id ?? ""} />
    </Suspense>
  );
}

async function EditorContent({ id }: { id: string }) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManageWebsite(roles)) {
    redirect("/dashboard");
  }

  const neu = id === "neu" || id === "";
  let daten: SeiteDaten;
  if (neu) {
    daten = {
      id: null,
      slug: "",
      typ: "SEITE",
      typFixiert: false,
      inNavigation: true,
      navSortOrder: 50,
      imFuss: false,
      active: true,
      de: { titel: "", untertitel: "", inhalt: "", seoTitel: "", seoBeschreibung: "" },
      en: null,
    };
  } else {
    const seite = await db.orm.public.WebsiteSeite
      .where({ id })
      .select("id", "slug", "typ", "inNavigation", "navSortOrder", "imFuss", "active")
      .include("uebersetzungen")
      .first();
    if (!seite) notFound();
    const de = seite.uebersetzungen.find((u) => u.locale === "DE");
    const en = seite.uebersetzungen.find((u) => u.locale === "EN");
    if (!de) notFound();
    daten = {
      id: seite.id,
      slug: seite.slug,
      typ: seite.typ,
      typFixiert: seite.typ !== "SEITE",
      inNavigation: seite.inNavigation,
      navSortOrder: seite.navSortOrder,
      imFuss: seite.imFuss,
      active: seite.active,
      de: {
        titel: de.titel,
        untertitel: de.untertitel ?? "",
        inhalt: de.inhalt,
        seoTitel: de.seoTitel ?? "",
        seoBeschreibung: de.seoBeschreibung ?? "",
      },
      en: en
        ? {
            titel: en.titel,
            untertitel: en.untertitel ?? "",
            inhalt: en.inhalt,
            seoTitel: en.seoTitel ?? "",
            seoBeschreibung: en.seoBeschreibung ?? "",
          }
        : null,
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">
          {neu ? "Neue Seite" : `Seite «${daten.slug}» bearbeiten`}
        </h1>
        {daten.id && (
          <Link
            href={daten.typ === "START" ? "/" : `/${daten.slug}`}
            target="_blank"
            className="text-sm text-slate-600 transition hover:text-brand-700"
          >
            Öffentliche Seite ansehen ↗
          </Link>
        )}
      </div>
      <SeiteForm seite={daten} />
      {daten.id && daten.typ !== "START" && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Gefährliche Aktionen</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Seite löschen (nur möglich, wenn sie nicht die Startseite ist). Sprachseiten hängen an der
            Stammdaten-Sprache — beim Löschen der Sprache verschwindet die Seite mit.
          </p>
          <SeiteLoeschenButton seiteId={daten.id} canDelete />
        </div>
      )}
    </div>
  );
}
