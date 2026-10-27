import { describe, expect, it } from "vitest";

import {
  formatiereTestResultat,
  istGueltigeEmail,
  istStufeBestanden,
  niveauEmpfehlung,
  parseTestResultat,
} from "./logik";

describe("istStufeBestanden", () => {
  it("besteht bei mindestens der Hälfte richtiger Antworten", () => {
    expect(istStufeBestanden({ code: "A1", richtig: 2, total: 3 })).toBe(true);
    expect(istStufeBestanden({ code: "A1", richtig: 1, total: 2 })).toBe(true);
    expect(istStufeBestanden({ code: "A1", richtig: 0, total: 1 })).toBe(false);
    expect(istStufeBestanden({ code: "A1", richtig: 1, total: 3 })).toBe(false);
  });

  it("blockiert nicht bei fehlenden Fragen (total 0)", () => {
    expect(istStufeBestanden({ code: "C2", richtig: 0, total: 0 })).toBe(true);
  });
});

describe("niveauEmpfehlung", () => {
  it("empfiehlt die erste Stufe, wenn diese scheitert (Einstieg)", () => {
    const e = niveauEmpfehlung([
      { code: "A1", richtig: 0, total: 3 },
      { code: "A2", richtig: 3, total: 3 },
    ]);
    expect(e?.code).toBe("A1");
    expect(e?.begruendung).toContain("Einstieg");
  });

  it("empfiehlt die erste nicht bestandene Stufe nach abgeschlossener Stufe davor", () => {
    const e = niveauEmpfehlung([
      { code: "A1", richtig: 3, total: 3 },
      { code: "A2", richtig: 1, total: 3 },
      { code: "B1", richtig: 3, total: 3 },
    ]);
    expect(e?.code).toBe("A2");
  });

  it("empfiehlt das höchste geprüfte Niveau, wenn alle bestanden", () => {
    const e = niveauEmpfehlung([
      { code: "A1", richtig: 2, total: 3 },
      { code: "A2", richtig: 2, total: 3 },
    ]);
    expect(e?.code).toBe("A2");
    expect(e?.begruendung).not.toContain("Gespräch");
  });

  it("hebt 100 % richtig hervor", () => {
    const e = niveauEmpfehlung([{ code: "B1", richtig: 3, total: 3 }]);
    expect(e?.code).toBe("B1");
    expect(e?.begruendung).toContain("gespräch");
  });

  it("liefert null ohne geprüfte Stufen", () => {
    expect(niveauEmpfehlung([])).toBeNull();
    expect(niveauEmpfehlung([{ code: "A1", richtig: 0, total: 0 }])).toBeNull();
  });
});

describe("Test-Resultat-Format", () => {
  it("rundet durch formatieren + parsen", () => {
    const roh = formatiereTestResultat({
      proNiveau: [
        { code: "A1", richtig: 3, total: 3 },
        { code: "A2", richtig: 2, total: 3 },
        { code: "B1", richtig: 0, total: 0 }, // nicht geprüft → ausgelassen
      ],
      empfehlungCode: "A2",
    });
    expect(roh).toBe("A1:3/3~A2:2/3");
    const res = parseTestResultat(roh);
    expect(res?.proNiveau).toEqual([
      { code: "A1", richtig: 3, total: 3 },
      { code: "A2", richtig: 2, total: 3 },
    ]);
    expect(res?.empfehlungCode).toBe("A2");
  });

  it("verwirft kaputte Resultate (null)", () => {
    expect(parseTestResultat("A1:3/3~kaputt")).toBeNull();
    expect(parseTestResultat("A1:5/3")).toBeNull();
    expect(parseTestResultat("A1:3/3;A2:1/3")).toBeNull();
    expect(parseTestResultat("")).toBeNull();
    expect(parseTestResultat(null)).toBeNull();
  });
});

describe("istGueltigeEmail", () => {
  it("akzeptiert normale E-Mails", () => {
    expect(istGueltigeEmail("test@example.com")).toBe(true);
    expect(istGueltigeEmail("vor.nachname@sub.domain.ch")).toBe(true);
  });
  it("lehnt Unvollständiges ab", () => {
    expect(istGueltigeEmail("kein-at.ch")).toBe(false);
    expect(istGueltigeEmail("a@b")).toBe(false);
    expect(istGueltigeEmail("")).toBe(false);
  });
});
