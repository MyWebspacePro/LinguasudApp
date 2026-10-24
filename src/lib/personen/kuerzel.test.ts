import { describe, expect, it } from "vitest";
import { kuerzelAscii, kuerzelBasis, kuerzelMitSuffix } from "./kuerzel";

describe("kuerzelAscii", () => {
  it("reduziert Umlaute auf ASCII-Buchstaben", () => {
    expect(kuerzelAscii("Müller")).toBe("MULLER");
    expect(kuerzelAscii("Öztürk")).toBe("OZTURK");
    expect(kuerzelAscii("Straße")).toBe("STRASSE");
  });

  it("entfernt Akzente und Interpunktion", () => {
    expect(kuerzelAscii("José")).toBe("JOSE");
    expect(kuerzelAscii("O'Brien")).toBe("OBRIEN");
    expect(kuerzelAscii("van der Berg")).toBe("VANDERBERG");
  });

  it("behält nicht-ASCII-Schriften als Buchstaben-Fallback", () => {
    expect(kuerzelAscii("王")).toBe("王");
    expect(kuerzelAscii("Ø")).toBe("Ø");
  });

  it("liefert leer bei Zahlen/Zeichen ohne Buchstaben", () => {
    expect(kuerzelAscii("123")).toBe("");
  });
});

describe("kuerzelBasis", () => {
  it("bildet Vorname[1] + Nachname[3] (Beispiel aus dem Pflichtenheft-Stil)", () => {
    expect(kuerzelBasis("Sandra", "Mittal")).toBe("SMIT");
  });

  it("reduziert Umlaute (ein Zeichen pro Umlaut)", () => {
    expect(kuerzelBasis("Maria", "Müller")).toBe("MMUL");
    expect(kuerzelBasis("Björn", "Straße")).toBe("BSTR");
  });

  it("kommt mit kurzen Namen aus", () => {
    expect(kuerzelBasis("Kim", "Ng")).toBe("KNG");
    expect(kuerzelBasis("Jo", "Li")).toBe("JLI");
  });

  it("ist leer, wenn kein Buchstabe ableitbar ist", () => {
    expect(kuerzelBasis("123", "456")).toBe("");
    expect(kuerzelBasis("", "")).toBe("");
  });
});

describe("kuerzelMitSuffix", () => {
  it("liefert die Basis ohne Suffix", () => {
    expect(kuerzelMitSuffix("SMIT", 0)).toBe("SMIT");
  });

  it("hängt zweistellige Suffixe an", () => {
    expect(kuerzelMitSuffix("SMIT", 1)).toBe("SMIT01");
    expect(kuerzelMitSuffix("SMIT", 12)).toBe("SMIT12");
  });
});
