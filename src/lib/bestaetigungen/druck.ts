import "server-only";

// Kursbestätigungs-PDF laden (Modul 10): Snapshots aus der DB, Schuladresse
// aus der Konfiguration (gleich wie QR-Rechnung) und das Logo aus public/
// (Platzhalter-Asset public/logo-linguasud.png — kann 1:1 ersetzt werden,
// alternativ .jpg; fehlt die Datei, druckt das PDF ohne Logo).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, fromDbTime } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { dateKeyOf } from "@/lib/zeit";
import { baueBestaetigungsPdf } from "./pdf";

export interface BestaetigungPdfLadung {
  dateiname: string;
  bytes: Uint8Array;
}

/** Lädt die Bestätigung und erzeugt das PDF. */
export async function ladeBestaetigungsPdf(bestaetigungId: string): Promise<BestaetigungPdfLadung> {
  const bestaetigung = await db.orm.public.Kursbestaetigung.where({ id: bestaetigungId }).first();
  if (!bestaetigung) throw new Error("Kursbestätigung nicht gefunden.");

  const env = getEnv();
  const ausstellungsdatum = dateKeyOf(fromDbTime(bestaetigung.ausstellungsdatum));

  const bytes = await baueBestaetigungsPdf({
    schule: {
      name: env.QR_RECHNUNG_NAME || "Sprachschule linguasud",
      strasse: env.QR_RECHNUNG_STRASSE || "",
      plz: env.QR_RECHNUNG_PLZ || "",
      ort: env.QR_RECHNUNG_ORT || "Schaffhausen",
    },
    personAnrede: bestaetigung.personAnrede,
    personName: bestaetigung.personName,
    sprache: bestaetigung.spracheName,
    niveauCode: bestaetigung.niveauCode,
    niveauName: bestaetigung.niveauName,
    kursart: bestaetigung.kursartName,
    kursCode: bestaetigung.kursCode,
    zeitraumVon: dateKeyOf(fromDbTime(bestaetigung.zeitraumVon)),
    zeitraumBis: dateKeyOf(fromDbTime(bestaetigung.zeitraumBis)),
    besuchteLektionen: bestaetigung.besuchteLektionen,
    ausstellungsdatum,
    logoBytes: await ladeLogo(),
  });

  // ASCII-sicherer Dateiname (Content-Disposition ohne RFC-5987-Kodierung).
  const dateiname = `Kursbestaetigung-${bestaetigung.niveauCode}-${ausstellungsdatum}.pdf`;
  return { dateiname, bytes };
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
