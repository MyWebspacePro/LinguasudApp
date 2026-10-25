import "server-only";

// Kursbestätigungs-PDF (Modul 10): A4, Standardfonts Helvetica (WinAnsi,
// Umlaute ok). Inhalt laut Pflichtenheft: Anrede + Name, Sprache + niveau,
// Kursart, Zeitraum, besuchte Lektionen, Datum, Logo + Unterschriftszeile —
// nur Deutsch, keine Leistungsbewertung. Das Logo ist ein Platzhalter-Asset
// unter public/ (kann später ersetzt werden); fehlt es, bleibt es beim
// Text-Briefkopf.

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
} from "pdf-lib";
import { formatDatum } from "@/lib/zeit";
import { anredeZeile, briefAnrede } from "./logik";

// mm → Punkt (72/inch)
const mm = (value: number) => (value * 72) / 25.4;

const SCHWARZ = rgb(0.09, 0.09, 0.09);
const GRAU = rgb(0.45, 0.45, 0.45);
const HELLGRAU = rgb(0.82, 0.82, 0.82);
const BRAND = rgb(0.44, 0.15, 0.27); // Bordeaux #712544

export interface BestaetigungPdfDaten {
  schule: { name: string; strasse: string; plz: string; ort: string };
  /** Anrede-Code der Person (HERR/FRAU/DIVERS). */
  personAnrede: string;
  personName: string;
  sprache: string;
  niveauCode: string;
  niveauName?: string | null;
  kursart: string;
  kursCode: string;
  zeitraumVon: string; // "YYYY-MM-DD"
  zeitraumBis: string; // "YYYY-MM-DD"
  besuchteLektionen: number;
  ausstellungsdatum: string; // "YYYY-MM-DD"
  /** Platzhalter-Logo (PNG/JPEG-Bytes aus public/); null = Text-Briefkopf. */
  logoBytes?: Uint8Array | null;
}

const A4 = { breite: mm(210), hoehe: mm(297) } as const;
const RAND = mm(20);

/** Erzeugt das Kursbestätigungs-PDF (eine Seite A4). */
export async function baueBestaetigungsPdf(daten: BestaetigungPdfDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Kursbestätigung ${daten.personName} — Niveau ${daten.niveauCode}`);
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
  schrift("KURSBESTÄTIGUNG", A4.breite - RAND, A4.hoehe - RAND, 15, { bold: true });
  schrift("Niveau-Abschnitt", A4.breite - RAND, A4.hoehe - RAND - 16, 8.5, { grau: true, align: "rechts" });

  // Trennlinie unter dem Briefkopf
  y -= 6;
  page.drawLine({
    start: { x: RAND, y: y + 2 },
    end: { x: A4.breite - RAND, y: y + 2 },
    thickness: 0.7,
    color: HELLGRAU,
  });

  // ——— Adressblock: Anrede + Name ———
  y -= 26;
  schrift(anredeZeile(daten.personAnrede, daten.personName), RAND, y, 11);
  y -= 26;

  // ——— Text ———
  schrift(briefAnrede(daten.personAnrede, daten.personName), RAND, y, 10.5);
  y -= 18;
  schrift(
    `wir bestätigen Ihnen den Besuch des folgenden Niveau-Abschnitts an der ${daten.schule.name}:`,
    RAND,
    y,
    10.5,
  );
  y -= 24;

  // ——— Fakten-Tabelle ———
  const nivelautext = daten.niveauName ? `${daten.niveauCode} — ${daten.niveauName}` : daten.niveauCode;
  const zeilen: [string, string][] = [
    ["Sprache", daten.sprache],
    ["Bestätigtes Niveau", nivelautext],
    ["Kursart", daten.kursart],
    ["Kurs-Nr.", daten.kursCode],
    ["Zeitraum", `${formatDatum(daten.zeitraumVon)} – ${formatDatum(daten.zeitraumBis)}`],
    ["Besuchte Lektionen", String(daten.besuchteLektionen)],
  ];

  const labelBreite = mm(58);
  for (const [label, wert] of zeilen) {
    page.drawRectangle({
      x: RAND,
      y: y - 4,
      width: A4.breite - 2 * RAND,
      height: 17,
      color: rgb(0.965, 0.955, 0.945),
    });
    schrift(label, RAND + 6, y, 9.5, { bold: true });
    schrift(wert, RAND + labelBreite, y, 9.5);
    y -= 21;
  }

  y -= 14;
  schrift("Die Bestätigung erfolgt ohne Bewertung der sprachlichen Leistungen.", RAND, y, 9, { grau: true });

  // ——— Gruss + Unterschrift ———
  y -= 34;
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
