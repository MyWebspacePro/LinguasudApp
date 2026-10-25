import "server-only";

// Honorar-Beleg laden (Modul 11): Monatsdaten der Lehrperson rechnen und
// das PDF erzeugen. Schuladresse aus der Konfiguration (gleich wie QR-
// Rechnung), Logo aus public/ (Platzhalter-Asset — fehlt es, druckt das
// PDF ohne).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { heuteDateKey } from "@/lib/zeit";
import { istMonatKey } from "./logik";
import { ladeMonatsAbrechnung } from "./abrechnung";
import { baueHonorarPdf } from "./pdf";

export interface HonorarPdfLadung {
  dateiname: string;
  bytes: Uint8Array;
}

/** Lädt die Monatsdaten der Lehrperson und erzeugt den Beleg. */
export async function ladeHonorarPdf(lehrpersonId: string, monatKey: string): Promise<HonorarPdfLadung> {
  if (!istMonatKey(monatKey)) throw new Error("Ungültiger Monat.");
  const lehrperson = await db.orm.public.Person.where({ id: lehrpersonId }).first();
  if (!lehrperson) throw new Error("Lehrperson nicht gefunden.");

  const { gruppen } = await ladeMonatsAbrechnung(monatKey);
  const gruppe = gruppen.find((g) => g.monat.lehrpersonId === lehrpersonId);
  if (!gruppe) throw new Error("Keine durchgeführten Lektionen für diesen Monat.");

  const env = getEnv();
  const bytes = await baueHonorarPdf({
    schule: {
      name: env.QR_RECHNUNG_NAME || "Sprachschule linguasud",
      strasse: env.QR_RECHNUNG_STRASSE || "",
      plz: env.QR_RECHNUNG_PLZ || "",
      ort: env.QR_RECHNUNG_ORT || "Schaffhausen",
    },
    lehrpersonName: gruppe.monat.lehrpersonName,
    kuerzel: gruppe.monat.kuerzel,
    monatKey,
    zeilen: gruppe.monat.zeilen.map((z) => ({
      datumKey: z.datumKey,
      kursBezeichnung: z.kursBezeichnung,
      kursCode: z.kursCode,
      dauerMinuten: z.dauerMinuten,
      stundensatz: z.stundensatz,
      betragChf: z.betragChf,
    })),
    totalChf: gruppe.monat.totalChf,
    ohneSatz: gruppe.monat.ohneSatz,
    ausstellungsdatum: heuteDateKey(),
    logoBytes: await ladeLogo(),
  });

  // ASCII-sicherer Dateiname (Content-Disposition ohne RFC-5987-Kodierung).
  const dateiname = `Honorar-${asciiName(lehrperson.vorname)}-${asciiName(lehrperson.nachname)}-${monatKey}.pdf`;
  return { dateiname, bytes };
}

function asciiName(s: string): string {
  return s.normalize("NFKD").replace(/[^a-zA-Z]/g, "") || "Lehrperson";
}

/** Logo-Asset aus public/ lesen (png vor jpg); ohne Datei → null. */
async function ladeLogo(): Promise<Uint8Array | null> {
  for (const datei of ["logo-linguasud.png", "logo-linguasud.jpg"]) {
    try {
      return new Uint8Array(await readFile(path.join(process.cwd(), "public", datei)));
    } catch {
      // Nächste Variante versuchen.
    }
  }
  return null;
}
