import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getEnv } from "@/lib/env";
import { db, fromDbTime } from "@/lib/db";

// Sitemap der öffentlichen Website (Modul 16): statische Angebote (Anfrage,
// Einstufungstest) plus alle aktiven CMS-Seiten und Sprachseiten mit ihren
// EN-Fassungen. DB-Zugriff → Request-Time (beim Build ist die Datenbank
// nicht erreichbar, der Prisma-Client nutzt intern crypto.randomUUID());
// connection() macht die Route dynamisch (Metadata-Routen unterstützen
// kein `instant`/Route-Segment-Config).

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const basis = getEnv().APP_URL.replace(/\/$/, "");

  const seiten = await db.orm.public.WebsiteSeite
    .where((s) => s.active.eq(true))
    .select("slug", "updatedAt")
    .all();

  const eintraege: MetadataRoute.Sitemap = [
    { url: `${basis}/anfrage`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${basis}/einstufungstest`, changeFrequency: "monthly", priority: 0.7 },
  ];

  for (const seite of seiten) {
    const pfad = seite.slug === "start" ? "" : `/${seite.slug}`;
    const lastModified = fromDbTime(String(seite.updatedAt));
    eintraege.push({
      url: `${basis}${pfad || "/"}`,
      lastModified,
      changeFrequency: "monthly",
      priority: seite.slug === "start" ? 1 : 0.8,
    });
    // EN-Fassung (fehlt die EN-Übersetzung, liefert die Route DE — die URL
    // bleibt nonetheless gültig und für Suchmaschinen auffindbar).
    eintraege.push({
      url: `${basis}/en${pfad}`,
      lastModified,
      changeFrequency: "monthly",
      priority: seite.slug === "start" ? 0.9 : 0.6,
    });
  }

  return eintraege;
}
