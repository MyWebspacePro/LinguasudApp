import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { landingRoute } from "@/lib/auth/permissions";
import { roleList } from "@/lib/db";
import {
  alternatesFuer,
  ladeMetadataFuerPfad,
  OeffentlicheSeite,
} from "@/components/oeffentlich/OeffentlicheSeite";

// Öffentliche CMS-Website (Modul 15): alle Pfade ohne eigenes statisches
// Ziel landen hier — Start («/»), CMS-Seiten («/ueber-uns», «/kontakt»,
// «/agb», …), Sprach-Unterseiten («/sprachen/deutsch») und die EN-Fassungen
// («/en/…»). Statische Routen (/anfrage, /einstufungstest, /login, /portal,
// …) haben Vorrang und bleiben unverändert. DB-Zugriff → Request-Time.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  // Request-Time-Rendering: der DB-Client nutzt intern crypto.randomUUID() —
  // ohne connection() würde der Metadata-Lauf beim Prerender brechen.
  await connection();
  const { slug } = (await params) ?? {};
  const segmente = slug ?? [];
  const meta = await ladeMetadataFuerPfad(segmente);
  if (!meta) {
    return { title: { absolute: "Seite nicht gefunden · Sprachschule linguasud" } };
  }
  return {
    // Absolute Titel: die CMS-SEO-Felder tragen den kompletten Titel bereits selbst.
    title: { absolute: meta.titel },
    description: meta.beschreibung ?? undefined,
    alternates: alternatesFuer(meta.pfad),
  };
}

export default async function OeffentlicheCatchAll({
  params,
}: {
  params?: Promise<{ slug?: string[] }>;
}) {
  const { slug } = (await params) ?? {};
  const segmente = slug ?? [];

  // Nur auf «/»: angemeldete Stabs-/Teilnehmende-Konten in die Verwaltung /
  // ins Portal leiten — anonyme Besucher sehen die CMS-Startseite.
  if (segmente.length === 0) {
    return (
      <Suspense fallback={null}>
        <StartseiteRouter />
      </Suspense>
    );
  }
  return <OeffentlicheSeite segmente={segmente} />;
}

async function StartseiteRouter() {
  const ctx = await getAuthContext();
  if (ctx) {
    if (ctx.user.mustChangePassword) {
      redirect("/passwort-aendern");
    }
    redirect(landingRoute(roleList(ctx.user.roles)));
    // redirect() wirft — dieser Punkt wird nie erreicht, TypeScript braucht ihn aber.
    return null;
  }
  return <OeffentlicheSeite segmente={[]} />;
}
