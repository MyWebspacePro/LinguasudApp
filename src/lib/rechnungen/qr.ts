// Schweizer QR-Rechnung (Modul 9, pure): QR-IBAN-Prüfung, Referenznummer
// (mod-10-rekursiv, 27-stellig) und der QR-Payload nach dem Swiss Payments
// Standard (SPC/0200, Adress-Typ S = strukturiert). Alles als reine
// Zeichenketten-Logik ohne Abhängigkeiten — getestet gegen die Referenz-
// Beispiele aus dem QR-Bill-Implementation-Guide (Swiss Payments).

/** Gewichte des mod-10-rekursiven Verfahrens (SIX Interbank Clearing). */
const MOD10_GEWINCHTE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5] as const;

/**
 * Prüfziffer der QR-Referenznummer: mod 10 rekursiv über die ersten 26 Ziffern
 * der Zahlungsteilnehmer-Referenz; die Prüfziffer ist die 27. Stelle.
 */
export function mod10RekursivPruefziffer(ziffern: string): number {
  let carry = 0;
  for (const zeichen of ziffern) {
    const ziffer = Number(zeichen);
    if (!Number.isInteger(ziffer)) throw new Error(`Keine Ziffer: «${zeichen}»`);
    carry = MOD10_GEWINCHTE[(carry + ziffer) % 10];
  }
  return (10 - carry) % 10;
}

/**
 * 27-stellige Referenznummer aus der laufenden Rechnungs-Nummer:
 * 26 Stellen (links mit Nullen aufgefüllt) + Prüfziffer.
 */
export function baueReferenzNr(laufnummer: number): string {
  if (!Number.isInteger(laufnummer) || laufnummer < 1 || String(laufnummer).length > 26) {
    throw new Error(`Ungültige Rechnungs-Laufnummer: ${laufnummer}`);
  }
  const basis = String(laufnummer).padStart(26, "0");
  return basis + String(mod10RekursivPruefziffer(basis));
}

/** IBAN ohne Leerzeichen, gross. */
export function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/** IBAN-Prüfziffern (mod 97): 1, wenn gültig. */
function mod97Prueft(iban: string): boolean {
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = zeichen >= "0" && zeichen <= "9" ? Number(zeichen) : zeichen.charCodeAt(0) - "A".charCodeAt(0) + 10;
    if (!Number.isInteger(wert) || wert < 0 || wert > 35) return false;
    // Buchstaben stehen für ZWEI Dezimalziffern (A=10) — in zwei Schritten
    // verarbeiten, sonst verschiebt sich die Basis (rest*10+12 ≠ rest*100+12).
    for (const ziffer of String(wert)) {
      rest = (rest * 10 + Number(ziffer)) % 97;
    }
  }
  return rest === 1;
}

/**
 * QR-IBAN: 21-stelliger CH/LI-IBAN, dessen Institutsnummer (IID, Stelle 4–8)
 * im QR-Bereich 30000–31999 liegt und dessen IBAN-Prüfsumme (mod 97) aufgeht.
 */
export function qrIbanGueltig(iban: string): boolean {
  const norm = normalisiereIban(iban);
  if (!/^[A-Z]{2}[0-9]{19}$/.test(norm)) return false;
  if (norm.slice(0, 2) !== "CH" && norm.slice(0, 2) !== "LI") return false;
  const iid = Number(norm.slice(4, 9));
  if (iid < 30000 || iid > 31999) return false;
  return mod97Prueft(norm);
}

export interface QrAdresse {
  name: string;
  strasse: string;
  /** Hausnummer (kann mit der Strasse kombiniert sein — dann hier leer). */
  hausnummer?: string;
  plz: string;
  ort: string;
  /** ISO-3166-1 alpha-2, z.B. "CH". */
  land: string;
}

export interface QrRechnungDaten {
  qrIban: string;
  /** Zahlungsempfänger (= Schulinstitution). */
  empfaenger: QrAdresse;
  /** Zahlungspflichtiger (optional — Rechnung bleibt auch ohne scannt). */
  zahlungspflichtiger?: QrAdresse;
  /** Betrag "1234.50" (immer 2 Dezimalen, ohne Tausendertrennzeichen). */
  betragChf: string;
  waehrung: "CHF";
  /** Fälligkeit als "YYYY-MM-DD" oder null (kein Datum im QR). */
  faelligAm?: string | null;
  /** 27-stellige QR-Referenznummer. */
  referenzNr: string;
  /** Unstrukturierte Mitteilung (z.B. Rechnungsnummer). */
  mitteilung?: string | null;
}

/** Feldlängen des Swiss Payments Standards (Positionen gekürzt). */
const MAX_LAENGE = {
  name: 70,
  strasse: 70,
  hausnummer: 16,
  plz: 16,
  ort: 35,
  mitteilung: 140,
  referenz: 27,
  betrag: 12,
} as const;

function kuerze(text: string, max: number): string {
  return text.slice(0, max);
}

/** Betrag ins QR-Format: "###.##", keine Tausendertrennzeichen. */
export function formatiereQrBetrag(betrag: string): string {
  const zahl = Number(betrag.replace(/[',\s]/g, "").replace(",", "."));
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 999_999_999.99) {
    throw new Error(`Ungültiger QR-Betrag: ${betrag}`);
  }
  return zahl.toFixed(2);
}

/** "YYYY-MM-DD" → QR-Fälligkeitsformat "YYYYMMDD". */
export function formatiereQrDatum(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Ungültiges Fälligkeitsdatum: ${dateKey}`);
  return dateKey.replace(/-/g, "");
}

/**
 * Baut den QR-Code-Inhalt (SPC/0200, Zeichensatz UTF-8, 27 Zeilen mit
 * Referenztyp-Feld). Referenzbeispiel des Implementation Guides liefert
 * exakt diese Struktur; der Trailer «EPD» schliesst den Payload ab.
 */
export function baueQrPayload(daten: QrRechnungDaten): string {
  const iban = normalisiereIban(daten.qrIban);
  if (!qrIbanGueltig(iban)) {
    throw new Error(`Kein gültiger QR-IBAN: ${iban} (QR-IID 30000–31999 erwartet)`);
  }
  if (!/^\d{27}$/.test(daten.referenzNr)) {
    throw new Error(`Referenznummer muss aus 27 Ziffern bestehen: ${daten.referenzNr}`);
  }

  const empfaenger = adressZeilend(daten.empfaenger);
  const zahlungspflichtiger = daten.zahlungspflichtiger ? adressZeilend(daten.zahlungspflichtiger) : null;

  return [
    "SPC",
    "0200",
    "1",
    iban,
    "S",
    kuerze(empfaenger.name, MAX_LAENGE.name),
    kuerze(empfaenger.strasse, MAX_LAENGE.strasse),
    kuerze(empfaenger.hausnummer ?? "", MAX_LAENGE.hausnummer),
    kuerze(empfaenger.plz, MAX_LAENGE.plz),
    kuerze(empfaenger.ort, MAX_LAENGE.ort),
    empfaenger.land,
    "", // Alternativschema 1
    "", // Alternativschema 2
    kuerze(formatiereQrBetrag(daten.betragChf), MAX_LAENGE.betrag),
    daten.waehrung,
    daten.faelligAm ? formatiereQrDatum(daten.faelligAm) : "",
    zahlungspflichtiger ? "S" : "",
    zahlungspflichtiger ? kuerze(zahlungspflichtiger.name, MAX_LAENGE.name) : "",
    zahlungspflichtiger ? kuerze(zahlungspflichtiger.strasse, MAX_LAENGE.strasse) : "",
    zahlungspflichtiger ? kuerze(zahlungspflichtiger.hausnummer ?? "", MAX_LAENGE.hausnummer) : "",
    zahlungspflichtiger ? kuerze(zahlungspflichtiger.plz, MAX_LAENGE.plz) : "",
    zahlungspflichtiger ? kuerze(zahlungspflichtiger.ort, MAX_LAENGE.ort) : "",
    zahlungspflichtiger ? zahlungspflichtiger.land : "",
    "QRR", // Referenztyp: QR-Referenz (27-stellig)
    kuerze(daten.referenzNr, MAX_LAENGE.referenz),
    kuerze(daten.mitteilung ?? "", MAX_LAENGE.mitteilung),
    "EPD",
  ].join("\n");
}

/** Adress-Splitting: "Vorstadt 18" → Strasse + Hausnummer (letzte Zifferngruppe). */
function adressZeilend(adresse: QrAdresse): QrAdresse {
  const ganz = `${adresse.strasse} ${adresse.hausnummer ?? ""}`.trim();
  const match = /^(.*?)(\d+\D*?)$/.exec(ganz);
  if (match) {
    return { ...adresse, strasse: match[1].trim(), hausnummer: match[2].trim() };
  }
  return { ...adresse, strasse: ganz, hausnummer: "" };
}
