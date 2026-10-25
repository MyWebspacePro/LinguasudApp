import "server-only";

// Rechnungs-PDF (Modul 9): klassischer Rechnungsteil (Positionen, MwSt,
// Total) plus Schweizer QR-Zahlteil am Seitenende — Empfangsschein (links)
// und Zahlteil mit 46×46-mm-QR-Code samt Schweizer Kreuz (rechts), getrennt
// durch die Perforationslinie. Layout nach dem QR-Bill-Standard (Sektion
// «Zahlteil» 210 × 105 mm), Fonts Standard Helvetica (WinAnsi).

import QRCode from "qrcode";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatDatum } from "@/lib/zeit";
import type { RechnungStatus } from "./logik";

// mm → Punkt (72/inch)
const mm = (value: number) => (value * 72) / 25.4;

const SCHWARZ = rgb(0.09, 0.09, 0.09);
const GRAU = rgb(0.45, 0.45, 0.45);
const HELLGRAU = rgb(0.82, 0.82, 0.82);
const BRAND = rgb(0.44, 0.15, 0.27); // Bordeaux #712544

export interface RechnungPdfPosition {
  text: string;
  menge: number;
  einzelpreisChf: string;
}

export interface RechnungPdfDaten {
  nummer: string;
  status: RechnungStatus;
  rechnungsdatum: string; // "YYYY-MM-DD"
  faelligAm: string; // "YYYY-MM-DD"
  empfaenger: { name: string; strasse: string; plz: string; ort: string; land: string };
  schule: { name: string; strasse: string; plz: string; ort: string; qrIban: string };
  positionen: readonly RechnungPdfPosition[];
  mwstSatzProzent: number | null;
  betragChf: string;
  mwstChf: string;
  totalChf: string;
  /** Summe erfasster Zahlungen ("0.00" bei keiner). */
  bezahltChf: string;
  notiz?: string | null;
  referenzNr: string;
  qrPayload: string;
}

const A4 = { breite: mm(210), hoehe: mm(297) } as const;
/** Der QR-Zahlteil belegt die unteren 105 mm der letzten Seite. */
const ZAHLTEIL_HOEHE = mm(105);
/** Trennlinie Empfangsschein/Zahlteil bei 62 mm. */
const EMPFANGSZEILE_X = mm(62);
const RAND = mm(18);

function betrag(wert: string): string {
  return Number(wert).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Referenznummer in 2er/5er-Blöcken ("21 00000 00003 …"). */
export function gruppiereReferenz(referenz: string): string {
  const gruppen: string[] = [referenz.slice(0, 2)];
  for (let i = 2; i < referenz.length; i += 5) gruppen.push(referenz.slice(i, i + 5));
  return gruppen.join(" ");
}

/** Erzeugt das Rechnungs-PDF (A4, zuletzt QR-Zahlteil). */
export async function baueRechnungsPdf(daten: RechnungPdfDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rechnung ${daten.nummer}`);
  pdf.setProducer("LinguasudApp");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const schrift = (page: PDFPage, text: string, x: number, y: number, size: number, opts?: { bold?: boolean; grau?: boolean; farbe?: ReturnType<typeof rgb>; align?: "rechts" }) => {
    const f = opts?.bold ? fontBold : font;
    const farbe = opts?.farbe ?? (opts?.grau ? GRAU : SCHWARZ);
    let xF = x;
    if (opts?.align === "rechts") xF = x - f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xF, y, size, font: f, color: farbe });
  };

  let page = pdf.addPage([A4.breite, A4.hoehe]);
  let y = A4.hoehe - RAND;

  // ——— Kopfbereich ———
  schrift(page, daten.schule.name, RAND, y, 13, { bold: true, farbe: BRAND });
  y -= 13;
  for (const zeile of [daten.schule.strasse, `${daten.schule.plz} ${daten.schule.ort}`]) {
    schrift(page, zeile, RAND, y, 8.5, { grau: true });
    y -= 11;
  }

  let kopfY = A4.hoehe - RAND;
  schrift(page, "RECHNUNG", A4.breite - RAND, kopfY, 16, { bold: true, align: "rechts" });
  kopfY -= 18;
  for (const [label, wert] of [
    ["Nummer", daten.nummer],
    ["Rechnungsdatum", formatDatum(daten.rechnungsdatum)],
    ["Zahlbar bis", formatDatum(daten.faelligAm)],
  ] as const) {
    schrift(page, label, A4.breite - RAND - 150, kopfY, 8.5, { grau: true });
    schrift(page, wert, A4.breite - RAND, kopfY, 8.5, { bold: true, align: "rechts" });
    kopfY -= 12;
  }

  y = Math.min(y, kopfY) - 16;

  // ——— Empfänger-Adresse ———
  page.drawLine({
    start: { x: RAND, y: y + 4 },
    end: { x: A4.breite - RAND, y: y + 4 },
    thickness: 0.7,
    color: HELLGRAU,
  });
  y -= 16;
  schrift(page, "Empfänger", RAND, y, 7, { grau: true });
  y -= 11;
  for (const zeile of [
    daten.empfaenger.name,
    daten.empfaenger.strasse,
    `${daten.empfaenger.plz} ${daten.empfaenger.ort}`,
    daten.empfaenger.land,
  ]) {
    if (zeile.trim()) {
      schrift(page, zeile, RAND, y, 10.5);
      y -= 13;
    }
  }
  y -= 14;

  // ——— Positionen ———
  const spalteMenge = A4.breite - RAND - 230;
  const spalteEinzelpreis = A4.breite - RAND - 120;
  const spalteBetrag = A4.breite - RAND;

  page.drawRectangle({ x: RAND, y: y - 4, width: A4.breite - 2 * RAND, height: 16, color: rgb(0.96, 0.95, 0.94) });
  schrift(page, "Position", RAND + 6, y, 8, { bold: true });
  schrift(page, "Anzahl", spalteMenge, y, 8, { bold: true, align: "rechts" });
  schrift(page, "Einzelpreis", spalteEinzelpreis, y, 8, { bold: true, align: "rechts" });
  schrift(page, "Betrag CHF", spalteBetrag, y, 8, { bold: true, align: "rechts" });
  y -= 18;

  const umbrechen = (text: string, breite: number, size: number, f: PDFFont): string[] => {
    const woerter = text.split(/\s+/);
    const zeilen: string[] = [];
    let aktuelle = "";
    for (const wort of woerter) {
      const probe = aktuelle ? `${aktuelle} ${wort}` : wort;
      if (f.widthOfTextAtSize(probe, size) > breite && aktuelle) {
        zeilen.push(aktuelle);
        aktuelle = wort;
      } else {
        aktuelle = probe;
      }
    }
    if (aktuelle) zeilen.push(aktuelle);
    return zeilen;
  };

  const positionstextBreite = spalteMenge - RAND - 24;
  for (const position of daten.positionen) {
    const zeilen = umbrechen(position.text, positionstextBreite, 9.5, font);
    // Platz prüfen: auf neuer Seite fortfahren (Zahlteil bleibt auf der letzten Seite).
    if (y - zeilen.length * 12 < A4.hoehe * 0.22) {
      page = pdf.addPage([A4.breite, A4.hoehe]);
      y = A4.hoehe - RAND - 20;
      schrift(page, `Rechnung ${daten.nummer} (Fortsetzung)`, RAND, y, 10, { bold: true, grau: true });
      y -= 20;
    }
    let zeilenY = y;
    zeilen.forEach((zeile, index) => {
      schrift(page, zeile, RAND + 6, zeilenY, 9.5, { grau: index > 0 });
      zeilenY -= 12;
    });
    schrift(page, String(position.menge), spalteMenge, y, 9.5, { align: "rechts" });
    schrift(page, betrag(position.einzelpreisChf), spalteEinzelpreis, y, 9.5, { align: "rechts" });
    schrift(page, betrag(String(Number(position.einzelpreisChf) * position.menge)), spalteBetrag, y, 9.5, { align: "rechts" });
    y = zeilenY - 4;
    page.drawLine({
      start: { x: RAND, y: y + 8 },
      end: { x: A4.breite - RAND, y: y + 8 },
      thickness: 0.4,
      color: rgb(0.93, 0.92, 0.9),
    });
  }
  y -= 10;

  // ——— Summen ———
  const summenX = spalteEinzelpreis;
  const summenZeile = (label: string, wert: string, bold = false, size = 9.5) => {
    schrift(page, label, summenX - 12, y, size, { grau: !bold, bold, align: "rechts" });
    schrift(page, wert, spalteBetrag, y, size, { bold, align: "rechts" });
    y -= size === 9.5 ? 14 : 16;
  };
  summenZeile("Zwischensumme", betrag(daten.betragChf));
  if (daten.mwstSatzProzent !== null && daten.mwstSatzProzent !== 0) {
    summenZeile(`MwSt ${Number(daten.mwstSatzProzent).toLocaleString("de-CH")}%`, betrag(daten.mwstChf));
  }
  const bezahlt = Number(daten.bezahltChf);
  if (bezahlt > 0) {
    summenZeile("Bereits bezahlt", `−${betrag(daten.bezahltChf)}`);
    const rest = Math.max(0, Number(daten.totalChf) - bezahlt).toFixed(2);
    summenZeile("Restbetrag", betrag(rest), true, 12);
  } else {
    summenZeile("Total CHF", betrag(daten.totalChf), true, 12);
  }
  y -= 6;

  if (daten.notiz) {
    for (const zeile of umbrechen(daten.notiz, A4.breite - 2 * RAND, 9, font)) {
      schrift(page, zeile, RAND, y, 9, { grau: true });
      y -= 12;
    }
    y -= 6;
  }

  // ——— Zahlungshinweis über dem Zahlteil — nur wenn er ohne Überlappung
  // passt; sonst entfällt er (Referenz, Fälligkeit und IBAN stehen im
  // QR-Zahlteil selbst). ———
  const sektionTop = A4.hoehe - ZAHLTEIL_HOEHE;
  if (y - 48 > sektionTop + 10) {
    schrift(page, `Zahlbar bis spätestens am ${formatDatum(daten.faelligAm)} auf die folgende Konto-Verbindung:`, RAND, y, 9, { grau: true });
    y -= 12;
    schrift(page, `QR-IBAN ${daten.schule.qrIban.replace(/(.{4})(?=\S)/g, "$1 ")}`, RAND, y, 9, { bold: true });
    y -= 12;
    schrift(page, `Referenznummer ${gruppiereReferenz(daten.referenzNr)}`, RAND, y, 9, { bold: true });
  }

  await zeichneZahlteil(pdf, daten, font, fontBold);

  return pdf.save();
}

/** Offener Betrag für den Zahlteil: Total abzüglich erfasster Zahlungen. */
function offenerBetrag(daten: RechnungPdfDaten): string {
  const bezahlt = Number(daten.bezahltChf);
  if (bezahlt <= 0) return daten.totalChf;
  return Math.max(0, Number(daten.totalChf) - bezahlt).toFixed(2);
}

/**
 * QR-Zahlteil am unteren Rand der letzten Seite: Empfangsschein (62 mm) und
 * Zahlteil (148 mm) mit QR-Code 46×46 mm + Schweizer Kreuz, Perforationslinie.
 */
async function zeichneZahlteil(
  pdf: PDFDocument,
  daten: RechnungPdfDaten,
  font: PDFFont,
  fontBold: PDFFont,
): Promise<void> {
  const page = pdf.getPages()[pdf.getPageCount() - 1];
  const sektionTop = A4.hoehe - ZAHLTEIL_HOEHE;
  const zeile = (text: string, x: number, yOffset: number, size: number, bold = false, grau = false) =>
    page.drawText(text, { x, y: yOffset, size, font: bold ? fontBold : font, color: grau ? GRAU : SCHWARZ });

  // Umrandung der Sektion + Perforationslinien ( gestrichelt )
  const gestrichelt = [2, 2];
  page.drawLine({ start: { x: 0, y: sektionTop }, end: { x: A4.breite, y: sektionTop }, thickness: 0.6, color: GRAU, dashArray: gestrichelt });
  page.drawLine({ start: { x: EMPFANGSZEILE_X, y: 0 }, end: { x: EMPFANGSZEILE_X, y: sektionTop }, thickness: 0.6, color: GRAU, dashArray: gestrichelt });

  // ——— Empfangsschein (links) ———
  const rx = 10;
  zeile("Empfangsschein", rx, sektionTop - 16, 7, true, true);
  let y = sektionTop - 44;
  for (const zeileText of [daten.schule.name, daten.schule.strasse, `${daten.schule.plz} ${daten.schule.ort}`]) {
    zeile(zeileText, rx, y, 6.5);
    y -= 8;
  }
  y -= 6;
  zeile("Referenz", rx, y, 6, false, true);
  y -= 9;
  zeile(gruppiereReferenz(daten.referenzNr), rx, y, 8, true);
  y -= 12;
  zeile("Währung / Betrag", rx, y, 6, false, true);
  y -= 9;
  zeile("CHF " + betrag(offenerBetrag(daten)), rx, y, 9, true);
  y -= 12;
  for (const zeileText of [daten.empfaenger.name, daten.empfaenger.strasse, `${daten.empfaenger.plz} ${daten.empfaenger.ort}`]) {
    zeile(zeileText, rx, y, 6.5);
    y -= 8;
  }
  zeile("Annahmestelle", rx, 12, 6, false, true);

  // ——— Zahlteil (rechts) ———
  const qx = EMPFANGSZEILE_X + mm(5);
  zeile("Zahlteil", qx, sektionTop - 16, 7, true, true);

  const qrGroesse = mm(46);
  const qrY = mm(6);
  const qrPng = await QRCode.toBuffer(daten.qrPayload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 640,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  const qrImage = await pdf.embedPng(qrPng);
  page.drawRectangle({ x: qx - 4, y: qrY - 4, width: qrGroesse + 8, height: qrGroesse + 8, color: rgb(1, 1, 1) });
  page.drawImage(qrImage, { x: qx, y: qrY, width: qrGroesse, height: qrGroesse });

  // Schweizer Kreuz in der Mitte (weisses Feld + Kreuz, Grösse ≈ 7 mm).
  const mitteX = qx + qrGroesse / 2;
  const mitteY = qrY + qrGroesse / 2;
  page.drawRectangle({ x: mitteX - mm(4.4), y: mitteY - mm(4.4), width: mm(8.8), height: mm(8.8), color: rgb(1, 1, 1) });
  page.drawRectangle({ x: mitteX - mm(3), y: mitteY - mm(1), width: mm(6), height: mm(2), color: SCHWARZ });
  page.drawRectangle({ x: mitteX - mm(1), y: mitteY - mm(3), width: mm(2), height: mm(6), color: SCHWARZ });

  // Labels rechts vom QR-Code.
  const lx = qx + qrGroesse + mm(8);
  let ly = sektionTop - 48;
  zeile("Währung / Betrag", lx, ly, 6, false, true);
  ly -= 9;
  zeile("CHF " + betrag(offenerBetrag(daten)), lx, ly, 10, true);
  ly -= 14;
  zeile("Referenznummer", lx, ly, 6, false, true);
  ly -= 9;
  for (const zeileText of gruppiereReferenz(daten.referenzNr).match(/.{1,24}/g) ?? []) {
    zeile(zeileText, lx, ly, 8, true);
    ly -= 10;
  }
  ly -= 6;
  zeile("Zahlbar bis", lx, ly, 6, false, true);
  ly -= 9;
  zeile(formatDatum(daten.faelligAm), lx, ly, 8, true);
  ly -= 14;
  zeile("Empfänger", lx, ly, 6, false, true);
  ly -= 9;
  for (const zeileText of [daten.schule.name, daten.schule.strasse, `${daten.schule.plz} ${daten.schule.ort}`]) {
    zeile(zeileText, lx, ly, 7.5);
    ly -= 9;
  }
}
