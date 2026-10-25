import { describe, expect, it } from "vitest";
import { kursartCode, kursCodeMitSerial, kursCodePraefix, KURS_CODE_MUSTER, naechsteSerial, zerlegeKursCode } from "./kurscode";

describe("kursartCode", () => {
  it("leitet die Beispiele des Pflichtenhefts ab", () => {
    expect(kursartCode("6er")).toBe("6ER");
    expect(kursartCode("Einzel")).toBe("EINZEL");
    expect(kursartCode("Firmenkurs")).toBe("FIRMENKURS");
    expect(kursartCode("Online")).toBe("ONLINE");
  });

  it("reduziert Umlaute und Trennzeichen", () => {
    expect(kursartCode("Konversationskurs")).toBe("KONVERSATIONSKURS");
    expect(kursartCode("Business-Englisch")).toBe("BUSINESSENGLISCH");
  });
});

describe("kursCodePraefix / kursCodeMitSerial", () => {
  it("baut das Pflichtenheft-Beispiel auf", () => {
    const praefix = kursCodePraefix("DE", "B2", "6er", "SMIT01");
    expect(kursCodeMitSerial(praefix, 1)).toBe("DE-B2-6ER-SMIT01-01");
  });

  it("ohne Lehrkürzel bleibt das Format gültig", () => {
    const code = kursCodeMitSerial(kursCodePraefix("FR", "A1", "Einzel", null), 3);
    expect(code).toBe("FR-A1-EINZEL-03");
    expect(KURS_CODE_MUSTER.test(code)).toBe(true);
  });
});

describe("naechsteSerial", () => {
  it("startet bei 01", () => {
    expect(naechsteSerial([], "DE-B2-6ER-SMIT01")).toBe(1);
  });

  it("nimmt die höchste vergebene Serial + 1 (auch über Präfixgrenzen)", () => {
    const existing = ["DE-B2-6ER-SMIT01-01", "DE-B2-6ER-SMIT01-02", "EN-A1-EINZEL-05"];
    expect(naechsteSerial(existing, "DE-B2-6ER-SMIT01")).toBe(3);
    expect(naechsteSerial(existing, "EN-A1-EINZEL")).toBe(6);
  });

  it("ignoriert Codes, die nur wie ein Präfix beginnen (SMIT01 vs. SMIT011)", () => {
    const existing = ["DE-B2-6ER-SMIT011-01", "DE-B2-6ER-SMIT0-01"];
    expect(naechsteSerial(existing, "DE-B2-6ER-SMIT01")).toBe(1);
  });
});

describe("KURS_CODE_MUSTER / zerlegeKursCode", () => {
  it("akzeptiert das Beispiel und zerlegt es", () => {
    const teile = zerlegeKursCode("DE-B2-6ER-SMIT01-01");
    expect(teile).toEqual({ sprache: "DE", niveau: "B2", kursart: "6ER", lehrKuerzel: "SMIT01", serial: 1 });
  });

  it("lehnt fremde Formate ab", () => {
    expect(zerlegeKursCode("XYZ")).toBeNull();
    expect(zerlegeKursCode("DE-B2-6ER-SMIT01-AB")).toBeNull();
  });
});
