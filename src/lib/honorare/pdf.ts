import "server-only";

// Honorar-Beleg-PDF (Modul 11): A4, Standardfonts Helvetica (WinAnsi,
// Umlaute ok) nach dem Muster der Kursbestätigungen. Inhalt laut
// Pflichtenheft: Datum, Kurs, Dauer, Satz, Total — pro Lehrperson und
// Monat. Briefkopf mit Logo (Platzhalter-Asset unter public/), sonst wie
// die Bestätigung: fehlt die Datei, druckt das PDF ohne.

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import { formatDatum } from "@/lib/zeit";
import { formatChf, monatLabel } from "./logik";

// mm → Punkt (72/inch)
const mm = (value: number) => (value * 72) / 25.4;

const SCHWARZ = rgb(0.09, 0.09, 0.09);
const GRAU = rgb(0.45, 0.45, 0.45);
const HELLGRAU = rgb(0.82, 0.82, 0.82);
const BRAND = rgb(0.44, 0.15, 0.27); // Bordeaux #712544

export interface HonorarBelegZeile {
  datumKey: string; // "YYYY-MM-DD"
  kursBezeichnung: string;
  kursCode: string;
  dauerMinuten: number;
  stundensatz: number | null;
  betragChf: number | null;
}

export interface HonorarPdfDaten {
  schule: { name: string; strasse: string; plz: string; ort: string };
  lehrpersonName: string;
  kuerzel: string | null;
  monatKey: string; // "YYYY-MM"
  zeilen: HonorarBelegZeile[];
  totalChf: number;
  /** Anzahl Lektionen ohne anwendbaren Satz (Hinweis unter der Tabelle). */
  ohneSatz: number;
  ausstellungsdatum: string; // "YYYY-MM-DD"
  /** Platzhalter-Logo (PNG/JPEG-Bytes aus public/); null = Text-Briefkopf. */
  logoBytes?: Uint8Array | null;
}

const A4 = { breite: mm(210), hoehe: mm(297) } as const;
const RAND = mm(20);

/** Erzeugt den Honorar-Beleg (eine Seite A4). */
export async function baueHonorarPdf(daten: HonorarPdfDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Honorarabrechnung ${daten.lehrpersonName} — ${monatLabel(daten.monatKey)}`);
  pdf.setProducer("LinguasudApp");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.breite, A4.hoehe]);

  const schrift = (
    text: string,
    x: number,
    y: number,
    size: number,
    opts?: { bold?: boolean; grau?: boolean; farbe?: ReturnType<typeof rgb>; align?: "rechts" },
  ) => {
    const f = opts?.bold ? fontBold : font;
    const farbe = opts?.farbe ?? (opts?.grau ? GRAU : SCHWARZ);
    const xF = opts?.align === "rechts" ? x - f.widthOfTextAtSize(text, size) : x;
    page.drawText(text, { x: xF, y, size, font: f, color: farbe });
  };

  // ——— Briefkopf: Logo (Platzhalter-Asset) + Schuladresse ———
  let y = A4.hoehe - RAND;
  const logo = await einbetten(pdf, daten.logoBytes);
  if (logo) {
    const groesse = mm(20);
    page.drawImage(logo, { x: RAND, y: y - groesse + mm(2), width: groesse, height: groesse });
  }
  const textX = RAND + (logo ? mm(26) : 0);
  schrift(daten.schule.name, textX, y, 13, { bold: true, farbe: BRAND });
  y -= 12;
  for (const zeile of [daten.schule.strasse, `${daten.schule.plz} ${daten.schule.ort}`]) {
    schrift(zeile, textX, y, 8.5, { grau: true });
    y -= 10.5;
  }
  schrift("HONORARABRECHNUNG", A4.breite - RAND, A4.hoehe - RAND, 15, { bold: true, align: "rechts" });
  schrift(monatLabel(daten.monatKey), A4.breite - RAND, A4.hoehe - RAND - 16, 8.5, { grau: true, align: "rechts" });

  // Trennlinie unter dem Briefkopf
  y -= 6;
  page.drawLine({
    start: { x: RAND, y: y + 2 },
    end: { x: A4.breite - RAND, y: y + 2 },
    thickness: 0.7,
    color: HELLGRAU,
  });

  // ——— Lehrperson ———
  y -= 26;
  schrift(`Honorar für ${daten.lehrpersonName}`, RAND, y, 11, { bold: true });
  y -= 14;
  const kuerzelText = daten.kuerzel ? ` (Kürzel ${daten.kuerzel})` : "";
  schrift(
    `Abgerechnet werden die im ${monatLabel(daten.monatKey)} durchgeführten Lektionen${kuerzelText}.`,
    RAND,
    y,
    10.5,
  );
  y -= 24;

  // ——— Tabelle: Datum · Kurs · Dauer · Satz · Betrag ———
  const spalten = {
    datum: RAND + 6,
    kurs: RAND + 6 + mm(24),
    dauer: A4.breite - RAND - mm(76),
    satz: A4.breite - RAND - mm(52),
    betrag: A4.breite - RAND - 6,
  };
  schrift("Datum", spalten.datum, y, 9, { bold: true, grau: true });
  schrift("Kurs", spalten.kurs, y, 9, { bold: true, grau: true });
  schrift("Dauer", spalten.dauer, y, 9, { bold: true, grau: true, align: "rechts" });
  schrift("Satz/h", spalten.satz, y, 9, { bold: true, grau: true, align: "rechts" });
  schrift("Betrag", spalten.betrag, y, 9, { bold: true, grau: true, align: "rechts" });
  y -= 6;

  for (const zeile of daten.zeilen) {
    page.drawRectangle({
      x: RAND,
      y: y - 4,
      width: A4.breite - 2 * RAND,
      height: 17,
      color: rgb(0.965, 0.955, 0.945),
    });
    schrift(formatDatum(zeile.datumKey), spalten.datum, y, 9.5);
    const kurs = zeile.kursCode ? `${zeile.kursBezeichnung} · ${zeile.kursCode}` : zeile.kursBezeichnung;
    schrift(kuerzeText(kurs, font, 9.5, mm(78)), spalten.kurs, y, 9.5);
    schrift(`${zeile.dauerMinuten} Min`, spalten.dauer, y, 9.5, { align: "rechts" });
    schrift(
      zeile.stundensatz !== null ? `CHF ${formatChf(zeile.stundensatz)}` : "—",
      spalten.satz,
      y,
      9.5,
      { align: "rechts", grau: zeile.stundensatz === null },
    );
    schrift(
      zeile.betragChf !== null ? `CHF ${formatChf(zeile.betragChf)}` : "kein Satz",
      spalten.betrag,
      y,
      9.5,
      { align: "rechts", bold: true, grau: zeile.betragChf === null },
    );
    y -= 21;
  }

  // ——— Total ———
  y -= 4;
  page.drawLine({
    start: { x: RAND, y: y + 2 },
    end: { x: A4.breite - RAND, y: y + 2 },
    thickness: 0.8,
    color: SCHWARZ,
  });
  y -= 20;
  schrift("Total", spalten.dauer, y, 11, { bold: true });
  schrift(`CHF ${formatChf(daten.totalChf)}`, spalten.betrag, y, 11, { bold: true, align: "rechts" });

  if (daten.ohneSatz > 0) {
    y -= 16;
    schrift(
      `${daten.ohneSatz} Lektion${daten.ohneSatz === 1 ? "" : "en"} ohne gepflegten Honorar-Satz (nicht im Total) — bitte Honorar-Matrix ergänzen.`,
      RAND,
      y,
      8.5,
      { grau: true },
    );
  }

  // ——— Gruss + Unterschrift ———
  y -= 30;
  schrift("Freundliche Grüsse", RAND, y, 10.5);

  const fussY = Math.max(y - 52, mm(38));
  schrift(`${daten.schule.ort}, ${formatDatum(daten.ausstellungsdatum)}`, RAND, fussY, 10);

  // Unterschriftszeile rechts mit Schulname darunter.
  const linkeBreite = mm(72);
  const linienStart = RAND + linkeBreite;
  page.drawLine({
    start: { x: linienStart, y: fussY + 2 },
    end: { x: A4.breite - RAND, y: fussY + 2 },
    thickness: 0.8,
    color: SCHWARZ,
  });
  schrift(daten.schule.name, linienStart, fussY - 12, 8.5, { grau: true });

  return pdf.save();
}

/** Kürzt Text mit Auslassungspunkten, damit er in die Spaltenbreite passt. */
function kuerzeText(text: string, font: PDFFont, size: number, breite: number): string {
  if (font.widthOfTextAtSize(text, size) <= breite) return text;
  let gekuerzt = text;
  while (gekuerzt.length > 1 && font.widthOfTextAtSize(`${gekuerzt}…`, size) > breite) {
    gekuerzt = gekuerzt.slice(0, -1);
  }
  return `${gekuerzt}…`;
}

/** Bettet das Logo ein (PNG oder JPEG); bei Fehler bleibt der Text-Briefkopf. */
async function einbetten(pdf: PDFDocument, bytes: Uint8Array | null | undefined): Promise<PDFImage | null> {
  if (!bytes || bytes.length === 0) return null;
  try {
    // PNG-Header (89 50 4E 47) vs. JPEG (FF D8) unterscheiden.
    return bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch (error) {
    console.error("Logo konnte nicht eingebettet werden:", error);
    return null;
  }
}
