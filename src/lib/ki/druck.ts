import "server-only";

// Lade- und Drucklogik für KI-Lektionspläne (Modul 14): prüft den Zugriff
// (eigene, geteilte oder Admin/Chef), holt die Stammdaten-Namen und erzeugt
// das PDF. Schuladresse und Logo wie bei den übrigen Belegen.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { dateKeyOf } from "@/lib/zeit";
import { baueKiLektionPdf, ergebnisFuerModus } from "./pdf";
import type { KiModus } from "@/lib/domain";

export interface KiPdfLadung {
  dateiname: string;
  bytes: Uint8Array;
}

export interface KiPdfAkteur {
  userId: string;
  istAdmin: boolean;
}

/**
 * Lädt eine sichtbare Lektion und erzeugt den Lektionsplan.
 * `null` = nicht vorhanden oder kein Zugriff (Route antwortet mit 404,
 * ohne die Existenz zu verraten).
 */
export async function ladeKiLektionPdf(
  lektionId: string,
  akteur: KiPdfAkteur,
): Promise<KiPdfLadung | null> {
  const row = await db.orm.public.KiLektion.where({ id: lektionId }).first();
  if (!row) return null;

  const zugriff = row.erstelltVonUserId === akteur.userId || row.geteilt || akteur.istAdmin;
  if (!zugriff) return null;

  const [sprache, niveau, kursart] = await Promise.all([
    row.spracheId ? db.orm.public.Sprache.where({ id: row.spracheId }).first() : Promise.resolve(null),
    row.niveauId ? db.orm.public.Niveau.where({ id: row.niveauId }).first() : Promise.resolve(null),
    row.kursartId ? db.orm.public.Kursart.where({ id: row.kursartId }).first() : Promise.resolve(null),
  ]);

  const modus: KiModus = row.modus;
  const ergebnis = ergebnisFuerModus(row.ergebnis, modus);
  const env = getEnv();

  const bytes = await baueKiLektionPdf({
    schule: {
      name: env.QR_RECHNUNG_NAME || "Sprachschule linguasud",
      strasse: env.QR_RECHNUNG_STRASSE || "",
      plz: env.QR_RECHNUNG_PLZ || "",
      ort: env.QR_RECHNUNG_ORT || "Schaffhausen",
    },
    titel: row.titel,
    modus,
    thema: row.thema,
    ergebnis,
    sprache: sprache?.name ?? null,
    niveau: niveau?.code ?? null,
    kursart: kursart?.name ?? null,
    dauerMinuten: dauerAusParameter(row.parameter),
    erstelltVonName: row.erstelltVonName,
    modell: row.modell,
    erstelltAmKey: dateKeyVon(row.createdAt),
    logoBytes: await ladeLogo(),
  });

  const dateiname = `KI-Lektionsplan-${asciiName(row.titel)}.pdf`;
  return { dateiname, bytes };
}

/** Dauer aus den gespeicherten Parametern lesen (nur Struktur-Modus). */
function dauerAusParameter(parameter: unknown): number | null {
  if (!parameter || typeof parameter !== "object") return null;
  const wert = (parameter as Record<string, unknown>).dauerMinuten;
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

/** createdAt (Date oder String aus der DB) → Kalendertag in der Schul-Zeitzone. */
function dateKeyVon(wert: unknown): string {
  if (wert instanceof Date) return dateKeyOf(wert);
  const s = String(wert ?? "");
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? dateKeyOf(new Date()) : dateKeyOf(date);
}

function asciiName(s: string): string {
  const bereinigt = s
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return bereinigt || "Lektion";
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
