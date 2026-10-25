import { describe, expect, it } from "vitest";
import {
  baueQrPayload,
  baueReferenzNr,
  formatiereQrBetrag,
  formatiereQrDatum,
  mod10RekursivPruefziffer,
  normalisiereIban,
  qrIbanGueltig,
} from "./qr";
import {
  berechneSumme,
  betragString,
  faelligkeitsDateKey,
  formatiereRechnungsnummer,
  istUeberfaellig,
  mahnStufeLabel,
  naechsteMahnStufe,
  restbetrag,
} from "./logik";

describe("qr — Referenznummer (mod 10 rekursiv)", () => {
  it("gibt die Prüfziffer des Referenzbeispiels aus dem QR-Bill-Guide zurück", () => {
    // Referenz 210000000003139471430009017 aus dem Swiss-QR-Beispiel.
    expect(mod10RekursivPruefziffer("21000000000313947143000901")).toBe(7);
  });

  it("baut eine 27-stellige Referenz mit gültiger Prüfziffer", () => {
    const referenz = baueReferenzNr(123);
    // 26-stelliger Basiswert (links mit Nullen aufgefüllt) + mod-10-Prüfziffer.
    expect(referenz).toHaveLength(27);
    expect(referenz.slice(0, 26)).toBe(String(123).padStart(26, "0"));
    expect(referenz.slice(26)).toBe(String(mod10RekursivPruefziffer(referenz.slice(0, 26))));
  });

  it("verweigert unsinnige Laufnummern", () => {
    expect(() => baueReferenzNr(0)).toThrow();
    expect(() => baueReferenzNr(1.5)).toThrow();
  });
});

describe("qr — QR-IBAN-Prüfung", () => {
  it("akzeptiert den Referenz-QR-IBAN aus dem QR-Bill-Guide", () => {
    expect(qrIbanGueltig("CH44 3199 9123 0008 8901 2")).toBe(true);
  });

  it("akzeptiert die normalisierte Form (gross, ohne Leerzeichen)", () => {
    expect(normalisiereIban("ch44 3199 9123 0008 8901 2")).toBe("CH4431999123000889012");
    expect(qrIbanGueltig("CH4431999123000889012")).toBe(true);
  });

  it("lehnt reguläre IBANs (IID ausserhalb 30000–31999) und ungültige Prüfsummen ab", () => {
    expect(qrIbanGueltig("CH9300762011623852957")).toBe(false); // normale IBAN, IID 00762
    expect(qrIbanGueltig("CH4431999123000889013")).toBe(false); // falsche Prüfziffer
    expect(qrIbanGueltig("CH443199912300088901")).toBe(false); // zu kurz
    expect(qrIbanGueltig("")).toBe(false);
  });
});

describe("qr — Payload (SPC/0200)", () => {
  const schule = {
    name: "Sprachschule linguasud",
    strasse: "Vorstadt 18",
    plz: "8200",
    ort: "Schaffhausen",
    land: "CH",
  };

  it("baut 27 Zeilen mit Referenztyp QRR und EPD-Trailer", () => {
    const payload = baueQrPayload({
      qrIban: "CH44 3199 9123 0008 8901 2",
      empfaenger: schule,
      zahlungspflichtiger: {
        name: "Ada Beispiel",
        strasse: "Musterweg 7",
        plz: "6000",
        ort: "Luzern",
        land: "CH",
      },
      betragChf: "510.00",
      waehrung: "CHF",
      faelligAm: "2026-11-24",
      referenzNr: baueReferenzNr(1),
      mitteilung: "Rechnung RE-2026-0001",
    });

    const zeilen = payload.split("\n");
    expect(zeilen).toHaveLength(27);
    expect(zeilen[0]).toBe("SPC");
    expect(zeilen[1]).toBe("0200");
    expect(zeilen[2]).toBe("1");
    expect(zeilen[3]).toBe("CH4431999123000889012");
    expect(zeilen[4]).toBe("S");
    expect(zeilen[6]).toBe("Vorstadt");
    expect(zeilen[7]).toBe("18");
    expect(zeilen[13]).toBe("510.00");
    expect(zeilen[14]).toBe("CHF");
    expect(zeilen[15]).toBe("20261124");
    expect(zeilen[16]).toBe("S");
    expect(zeilen[17]).toBe("Ada Beispiel");
    expect(zeilen[23]).toBe("QRR");
    expect(zeilen[24]).toHaveLength(27);
    expect(zeilen[26]).toBe("EPD");
  });

  it("ohne Zahlungspflichtiger bleiben die Debitor-Zeilen leer", () => {
    const zeilen = baueQrPayload({
      qrIban: "CH44 3199 9123 0008 8901 2",
      empfaenger: schule,
      betragChf: "100",
      waehrung: "CHF",
      referenzNr: baueReferenzNr(2),
    }).split("\n");
    for (const i of [16, 17, 18, 19, 20, 21, 22]) expect(zeilen[i]).toBe("");
    expect(zeilen[13]).toBe("100.00");
  });

  it("nimmt die offizielle Referenznummer des Implementation Guides unverändert ins Feld 25 auf", () => {
    const payload = baueQrPayload({
      qrIban: "CH44 3199 9123 0008 8901 2",
      empfaenger: schule,
      betragChf: "1949.75",
      waehrung: "CHF",
      referenzNr: "210000000003139471430009017",
    });
    expect(payload.split("\n")[24]).toBe("210000000003139471430009017");
  });

  it("verweigert Payload ohne gültigen QR-IBAN", () => {
    expect(() =>
      baueQrPayload({
        qrIban: "CH9300762011623852957",
        empfaenger: schule,
        betragChf: "100",
        waehrung: "CHF",
        referenzNr: baueReferenzNr(3),
      }),
    ).toThrow(/QR-IBAN/);
  });
});

describe("qr — Formathelfer", () => {
  it("formatiert Beträge und Fälligkeitsdaten", () => {
    expect(formatiereQrBetrag("1'234.50")).toBe("1234.50");
    expect(formatiereQrBetrag("480")).toBe("480.00");
    expect(formatiereQrDatum("2026-11-24")).toBe("20261124");
  });
});

describe("logik — Summe, Restbetrag, Fälligkeit", () => {
  it("rechnet Positionen × Menge und MwSt zusammen", () => {
    const summe = berechneSumme(
      [
        { text: "Paket 14 Lektionen", menge: 1, einzelpreisChf: "480.00" },
        { text: "Lehrmittel A2", menge: 2, einzelpreisChf: "35.50" },
      ],
      8.1,
    );
    expect(summe.betragChf).toBe("551.00");
    expect(summe.mwstChf).toBe("44.63");
    expect(summe.totalChf).toBe("595.63");
  });

  it("ohne MwSt-Satz bleibt total = Positionssumme", () => {
    const summe = berechneSumme(
      [{ text: "Paket", menge: 1, einzelpreisChf: "480.00" }],
      null,
    );
    expect(summe.totalChf).toBe("480.00");
    expect(summe.mwstChf).toBe("0.00");
  });

  it("Restbetrag subtrahiert Teilzahlungen und klemmt bei 0", () => {
    expect(restbetrag("595.63", ["100.00"])).toBe("495.63");
    expect(restbetrag("100.00", ["60.00", "40.00"])).toBe("0.00");
    expect(restbetrag("100.00", ["120.00"])).toBe("0.00");
  });

  it("Fälligkeit = Rechnungsdatum + 30 Tage", () => {
    expect(faelligkeitsDateKey("2026-10-25")).toBe("2026-11-24");
    expect(faelligkeitsDateKey("2026-01-01", 10)).toBe("2026-01-11");
  });

  it("formatiert Rechnungsnummern", () => {
    expect(formatiereRechnungsnummer(2026, 1)).toBe("RE-2026-0001");
    expect(formatiereRechnungsnummer(2026, 1234)).toBe("RE-2026-1234");
  });
});

describe("logik — Überfälligkeit und Mahn-Stufen", () => {
  it("versendet Rechnungen sind ab dem Tag nach Fälligkeit überfällig", () => {
    expect(istUeberfaellig("VERSENDET", "2026-10-10", "2026-10-10")).toBe(false);
    expect(istUeberfaellig("VERSENDET", "2026-10-10", "2026-10-11")).toBe(true);
    expect(istUeberfaellig("TEILBEZAHLT", "2026-10-10", "2026-11-01")).toBe(true);
    expect(istUeberfaellig("ENTWURF", "2026-10-10", "2026-11-01")).toBe(false);
    expect(istUeberfaellig("BEZAHLT", "2026-10-10", "2026-11-01")).toBe(false);
  });

  it("Stufe 1 nach 10, Stufe 2 nach 30 Tagen — je genau einmal", () => {
    expect(naechsteMahnStufe("VERSENDET", 0, "2026-10-10", "2026-10-19")).toBeNull();
    expect(naechsteMahnStufe("VERSENDET", 0, "2026-10-10", "2026-10-20")).toBe(1);
    expect(naechsteMahnStufe("VERSENDET", 1, "2026-10-10", "2026-10-20")).toBeNull();
    expect(naechsteMahnStufe("VERSENDET", 1, "2026-10-10", "2026-11-09")).toBe(2);
    expect(naechsteMahnStufe("VERSENDET", 2, "2026-10-10", "2026-12-01")).toBeNull();
    expect(naechsteMahnStufe("ENTWURF", 0, "2026-10-10", "2026-12-01")).toBeNull();
    expect(naechsteMahnStufe("BEZAHLT", 0, "2026-10-10", "2026-12-01")).toBeNull();
  });

  it("Mahn-Labels", () => {
    expect(mahnStufeLabel(0)).toBe("—");
    expect(mahnStufeLabel(1)).toBe("Erinnerung (Stufe 1)");
    expect(mahnStufeLabel(2)).toBe("Mahnung (Stufe 2)");
  });
});

describe("logik — Beträge", () => {
  it("schreibt DB-Beträge mit 2 Dezimalen", () => {
    expect(betragString(480)).toBe("480.00");
    expect(betragString(44.631)).toBe("44.63");
    expect(() => betragString(-1)).toThrow();
  });
});
