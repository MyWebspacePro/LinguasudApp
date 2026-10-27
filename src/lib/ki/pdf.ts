import "server-only";

// KI-Lektionsplan als PDF (Modul 14): A4, Helvetica (WinAnsi — Umlaute ok),
// mehrseitig mit automatischem Umbruch. Aufbau wie die übrigen Belege:
// Briefkopf mit Logo, Titel, Metadaten, dann je nach Modus die strukturierten
// Abschnitte (Lernziele, Ablauf, Materialien, Hausaufgabe) oder der Freitext.
// KI-Inhalte werden vor dem Druck auf WinAnsi-taugliche Zeichen gesäubert.

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatDatum } from "@/lib/zeit";
import {
  KI_MODUS_LABELS,
  type KiErgebnis,
  type KiErgebnisFrei,
  type KiErgebnisRohtext,
  type KiErgebnisStruktur,
} from "./logik";

// mm → Punkt (72/inch)
const mm = (value: number) => (value * 72) / 25.4;

const SCHWARZ = rgb(0.09, 0.09, 0.09);
const GRAU = rgb(0.45, 0.45, 0.45);
const HELLGRAU = rgb(0.82, 0.82, 0.82);
const BRAND = rgb(0.44, 0.15, 0.27); // Bordeaux #712544

const A4 = { breite: mm(210), hoehe: mm(297) } as const;
const RAND = mm(20);
const FUSS = mm(18); // Mindestabstand zum Seitenrand

export interface KiPdfDaten {
  schule: { name: string; strasse: string; plz: string; ort: string };
  titel: string;
  modus: "STRUKTUR" | "FREI";
  thema: string | null;
  ergebnis: KiErgebnis | null;
  sprache: string | null;
  niveau: string | null;
  kursart: string | null;
  dauerMinuten: number | null;
  erstelltVonName: string;
  modell: string | null;
  /** Kalendertag "YYYY-MM-DD" (Schul-Zeitzone). */
  erstelltAmKey: string;
  logoBytes?: Uint8Array | null;
}

/** WinAnsi-Säuberung: typografische Zeichen ersetzen, Nicht-WinAnsi entfernen. */
export function winAnsi(text: string): string {
  return text
    .replace(/ß/g, "ss")
    .replace(/[„“”«»]/g, '"')
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[•·]/g, "-")
    .replace(/[^\u0000-\u00ff€]/g, "");
}

/** Bricht Text auf eine Breite um (Wortgrenzen, harte Umbrüche bleiben). */
function umbrechen(text: string, font: PDFFont, size: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of winAnsi(text).split(/\r?\n/)) {
    const woerter = absatz.split(/\s+/).filter(Boolean);
    if (woerter.length === 0) {
      zeilen.push("");
      continue;
    }
    let aktuell = "";
    for (const wort of woerter) {
      const kandidat = aktuell ? `${aktuell} ${wort}` : wort;
      if (font.widthOfTextAtSize(kandidat, size) <= breite) {
        aktuell = kandidat;
        continue;
      }
      if (aktuell) zeilen.push(aktuell);
      // Sehr langes Einzelwort: hart trennen.
      if (font.widthOfTextAtSize(wort, size) > breite) {
        let rest = wort;
        while (font.widthOfTextAtSize(rest, size) > breite) {
          let teil = rest;
          while (teil.length > 1 && font.widthOfTextAtSize(`${teil}-`, size) > breite) {
            teil = teil.slice(0, -1);
          }
          zeilen.push(`${teil}-`);
          rest = rest.slice(teil.length);
        }
        aktuell = rest;
      } else {
        aktuell = wort;
      }
    }
    if (aktuell) zeilen.push(aktuell);
  }
  return zeilen;
}

/** Erzeugt den Lektionsplan als PDF (mehrseitig). */
export async function baueKiLektionPdf(daten: KiPdfDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`KI-Lektionsplan — ${daten.titel}`);
  pdf.setProducer("LinguasudApp");
  pdf.setCreator("LinguasudApp KI-Lektionsgenerator");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await einbetten(pdf, daten.logoBytes);
  const inhaltsBreite = A4.breite - 2 * RAND;

  let page: PDFPage = pdf.addPage([A4.breite, A4.hoehe]);
  let y = A4.hoehe - RAND;

  const neueSeite = () => {
    page = pdf.addPage([A4.breite, A4.hoehe]);
    y = A4.hoehe - RAND;
    schrift(daten.schule.name, RAND, y, 9, { bold: true, farbe: BRAND });
    schrift(daten.titel, A4.breite - RAND, y, 8.5, { grau: true, align: "rechts" });
    y -= 8;
    page.drawLine({
      start: { x: RAND, y },
      end: { x: A4.breite - RAND, y },
      thickness: 0.5,
      color: HELLGRAU,
    });
    y -= 20;
  };

  const platz = (hoehe: number) => {
    if (y - hoehe < FUSS) neueSeite();
  };

  function schrift(
    text: string,
    x: number,
    yPos: number,
    size: number,
    opts?: { bold?: boolean; grau?: boolean; farbe?: ReturnType<typeof rgb>; align?: "rechts" },
  ) {
    const f = opts?.bold ? fontBold : font;
    const farbe = opts?.farbe ?? (opts?.grau ? GRAU : SCHWARZ);
    const sicher = winAnsi(text);
    const xF = opts?.align === "rechts" ? x - f.widthOfTextAtSize(sicher, size) : x;
    page.drawText(sicher, { x: xF, y: yPos, size, font: f, color: farbe });
  }

  function absatz(
    text: string,
    opts?: { size?: number; bold?: boolean; grau?: boolean; einzug?: number; abstand?: number },
  ) {
    const size = opts?.size ?? 10;
    const einzug = opts?.einzug ?? 0;
    const zeilen = umbrechen(text, opts?.bold ? fontBold : font, size, inhaltsBreite - einzug);
    for (const zeile of zeilen) {
      platz(size + 4);
      schrift(zeile, RAND + einzug, y, size, { bold: opts?.bold, grau: opts?.grau });
      y -= size + 4;
    }
    y -= opts?.abstand ?? 2;
  }

  function aufzaehlung(punkte: string[]) {
    for (const punkt of punkte) {
      const zeilen = umbrechen(punkt, font, 10, inhaltsBreite - mm(6));
      zeilen.forEach((zeile, index) => {
        platz(14);
        if (index === 0) schrift("-", RAND, y, 10, { grau: true });
        schrift(zeile, RAND + mm(6), y, 10);
        y -= 14;
      });
      y -= 2;
    }
  }

  function ueberschrift(text: string) {
    platz(30);
    y -= 8;
    schrift(text, RAND, y, 11.5, { bold: true, farbe: BRAND });
    y -= 6;
    page.drawLine({
      start: { x: RAND, y },
      end: { x: A4.breite - RAND, y },
      thickness: 0.5,
      color: HELLGRAU,
    });
    y -= 16;
  }

  // ——— Briefkopf ———
  if (logo) {
    const groesse = mm(20);
    page.drawImage(logo, { x: RAND, y: y - groesse + mm(2), width: groesse, height: groesse });
  }
  const textX = RAND + (logo ? mm(26) : 0);
  schrift(daten.schule.name, textX, y, 13, { bold: true, farbe: BRAND });
  y -= 12;
  for (const zeile of [daten.schule.strasse, `${daten.schule.plz} ${daten.schule.ort}`.trim()]) {
    if (!zeile) continue;
    schrift(zeile, textX, y, 8.5, { grau: true });
    y -= 10.5;
  }
  schrift("KI-LEKTIONSPLAN", A4.breite - RAND, A4.hoehe - RAND, 15, { bold: true, align: "rechts" });
  schrift(KI_MODUS_LABELS[daten.modus], A4.breite - RAND, A4.hoehe - RAND - 16, 8.5, {
    grau: true,
    align: "rechts",
  });

  y -= 6;
  page.drawLine({
    start: { x: RAND, y: y + 2 },
    end: { x: A4.breite - RAND, y: y + 2 },
    thickness: 0.7,
    color: HELLGRAU,
  });

  // ——— Titel + Metadaten ———
  y -= 30;
  const titelZeilen = umbrechen(daten.titel, fontBold, 16, inhaltsBreite);
  for (const zeile of titelZeilen) {
    schrift(zeile, RAND, y, 16, { bold: true });
    y -= 20;
  }
  y -= 2;

  if (daten.thema) absatz(daten.thema, { size: 10.5, grau: true, abstand: 10 });

  const meta: string[] = [];
  if (daten.sprache) meta.push(`Sprache: ${daten.sprache}`);
  if (daten.niveau) meta.push(`Niveau: ${daten.niveau}`);
  if (daten.kursart) meta.push(`Kursart: ${daten.kursart}`);
  if (daten.dauerMinuten) meta.push(`Dauer: ${daten.dauerMinuten} Minuten`);
  if (meta.length > 0) {
    const metaZeilen = umbrechen(meta.join("  ·  "), font, 9.5, inhaltsBreite);
    for (const zeile of metaZeilen) {
      schrift(zeile, RAND, y, 9.5, { grau: true });
      y -= 13;
    }
    y -= 4;
  }

  // ——— Inhalt ———
  const ergebnis = daten.ergebnis;
  if (ergebnis && "lernziele" in ergebnis) {
    const struktur = ergebnis as KiErgebnisStruktur;
    if (struktur.lernziele.length > 0) {
      ueberschrift("Lernziele");
      aufzaehlung(struktur.lernziele);
    }

    if (struktur.ablauf.length > 0) {
      ueberschrift("Ablauf");
      struktur.ablauf.forEach((schritt, index) => {
        platz(34);
        const kopf = `${schritt.phase} — ${schritt.dauerMinuten} Min`;
        schrift(kopf, RAND, y, 10.5, { bold: true });
        y -= 14;
        const zeilen = umbrechen(schritt.beschreibung, font, 9.5, inhaltsBreite - mm(4));
        zeilen.forEach((zeile) => {
          platz(13);
          schrift(zeile, RAND + mm(4), y, 9.5);
          y -= 13;
        });
        y -= index === struktur.ablauf.length - 1 ? 4 : 9;
      });
    }

    if (struktur.materialien.length > 0) {
      ueberschrift("Materialien");
      aufzaehlung(struktur.materialien);
    }

    if (struktur.hausaufgabe.trim()) {
      ueberschrift("Hausaufgabe");
      absatz(struktur.hausaufgabe);
    }
  } else if (ergebnis && "text" in ergebnis) {
    const frei = ergebnis as KiErgebnisFrei;
    for (const absatzText of frei.text.split(/\n{2,}/)) {
      if (absatzText.trim()) absatz(absatzText.trim(), { size: 10.5, abstand: 8 });
    }
  } else if (ergebnis && "rohtext" in ergebnis) {
    const roh = ergebnis as KiErgebnisRohtext;
    for (const absatzText of roh.rohtext.split(/\n{2,}/)) {
      if (absatzText.trim()) absatz(absatzText.trim(), { size: 10.5, abstand: 8 });
    }
  } else {
    absatz("Für diese Lektion ist kein druckbares Ergebnis gespeichert.", { grau: true });
  }

  // ——— Fusszeile auf jeder Seite ———
  const fussText = winAnsi(
    `KI-generiert (${daten.modell ?? "Modell unbekannt"}) am ${formatDatum(daten.erstelltAmKey)} von ${daten.erstelltVonName} — bitte fachlich prüfen.`,
  );
  const fussZeilen = umbrechen(fussText, font, 7.5, inhaltsBreite);
  const seiten = pdf.getPages();
  seiten.forEach((seite, index) => {
    seite.drawLine({
      start: { x: RAND, y: FUSS - 4 },
      end: { x: A4.breite - RAND, y: FUSS - 4 },
      thickness: 0.4,
      color: HELLGRAU,
    });
    let fy = FUSS - 12;
    for (const zeile of fussZeilen) {
      seite.drawText(zeile, { x: RAND, y: fy, size: 7.5, font, color: GRAU });
      fy -= 9;
    }
    seite.drawText(`${index + 1} / ${seiten.length}`, {
      x: A4.breite - RAND - font.widthOfTextAtSize(`${index + 1} / ${seiten.length}`, 7.5),
      y: FUSS - 12,
      size: 7.5,
      font,
      color: GRAU,
    });
  });

  return pdf.save();
}

/** Bettet das Logo ein (PNG oder JPEG); bei Fehler bleibt der Text-Briefkopf. */
async function einbetten(pdf: PDFDocument, bytes: Uint8Array | null | undefined) {
  if (!bytes || bytes.length === 0) return null;
  try {
    return bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch (error) {
    console.error("Logo konnte nicht eingebettet werden:", error);
    return null;
  }
}

/** Prüft, ob ein gespeichertes Ergebnis zu einem Modus passt. */
export function ergebnisFuerModus(ergebnis: unknown, modus: "STRUKTUR" | "FREI"): KiErgebnis | null {
  if (!ergebnis || typeof ergebnis !== "object") return null;
  const obj = ergebnis as Record<string, unknown>;
  if (modus === "STRUKTUR") {
    if (Array.isArray(obj.lernziele) && Array.isArray(obj.ablauf)) {
      return ergebnis as KiErgebnisStruktur;
    }
    if (typeof obj.rohtext === "string") return ergebnis as KiErgebnisRohtext;
    return null;
  }
  return typeof obj.text === "string" ? (ergebnis as KiErgebnisFrei) : null;
}
