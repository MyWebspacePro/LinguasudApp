import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

// robots.txt (Modul 16): die öffentliche Website ist frei indexierbar —
// Verwaltung, Portal und API sind ausgeschlossen. Sitemap wird verlinkt.
export default function robots(): MetadataRoute.Robots {
  const basis = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        // Auth & Konto
        "/login",
        "/passwort-aendern",
        "/passwort-vergessen",
        "/passwort-setzen",
        // Portal (Teilnehmende) & Beleg-Drucke
        "/portal",
        "/bestaetigungen",
        // Verwaltungsbereich
        "/dashboard",
        "/benutzer",
        "/personen",
        "/kurse",
        "/anmeldungen",
        "/rechnungen",
        "/anfragen",
        "/aufgaben",
        "/vermietungen",
        "/honorare",
        "/planer",
        "/ki-generator",
        "/bueroplan",
        "/website",
        "/audit",
        "/stammdaten",
        // Interne Seiten ohne SEO-Wert
        "/anfrage/erfolg",
        "/einstufungstest/ergebnis",
      ],
    },
    sitemap: `${basis}/sitemap.xml`,
  };
}
