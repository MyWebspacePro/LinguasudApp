import { describe, expect, it } from "vitest";
import {
  formatChf,
  gruppiereMonatsLektionen,
  honorarFuerLektion,
  istMonatKey,
  monatLabel,
  naechsterMonat,
  rundeFuenfRappen,
  satzFuerLektion,
  vorigerMonat,
  type MatrixSatz,
} from "./logik";

describe("rundeFuenfRappen", () => {
  it("rundet auf 5 Rappen (kaufmännisch)", () => {
    expect(rundeFuenfRappen(31.875)).toBe(31.9); // exakt halbe Runde → auf
    expect(rundeFuenfRappen(31.86)).toBe(31.85);
    expect(rundeFuenfRappen(31.87)).toBe(31.85);
    expect(rundeFuenfRappen(31.88)).toBe(31.9);
    expect(rundeFuenfRappen(45)).toBe(45);
  });
});

describe("honorarFuerLektion", () => {
  it("rechnet die Dauer vom Stundensatz hoch", () => {
    expect(honorarFuerLektion(40, 60)).toBe(40);
    expect(honorarFuerLektion(40, 45)).toBe(30);
    expect(honorarFuerLektion(45, 90)).toBe(67.5);
  });

  it("rundet auf 5 Rappen", () => {
    // 42.50 CHF/h × 45 Min = 31.875 → 31.90
    expect(honorarFuerLektion(42.5, 45)).toBe(31.9);
    // 50 CHF/h × 90 Min = 75 exakt
    expect(honorarFuerLektion(50, 90)).toBe(75);
  });
});

describe("satzFuerLektion", () => {
  const saetze: MatrixSatz[] = [
    { lehrpersonId: "p1", kursartId: "k1", minuten: 60, stundensatz: 55 },
    { lehrpersonId: "p1", kursartId: "k2", minuten: 90, stundensatz: 48 },
  ];

  it("nimmt die Abweichung bei exaktem Treffer", () => {
    expect(
      satzFuerLektion({ lehrpersonId: "p1", kursartId: "k1", dauerMinuten: 60 }, saetze, 40),
    ).toEqual({ stundensatz: 55, quelle: "ABWEICHUNG" });
  });

  it("fällt auf den Default zurück (Dauer wird hochgerechnet)", () => {
    expect(
      satzFuerLektion({ lehrpersonId: "p1", kursartId: "k1", dauerMinuten: 90 }, saetze, 40),
    ).toEqual({ stundensatz: 40, quelle: "DEFAULT" });
  });

  it("gibt null zurück ohne Abweichung und ohne Default", () => {
    expect(
      satzFuerLektion({ lehrpersonId: "p2", kursartId: "k1", dauerMinuten: 60 }, saetze, null),
    ).toBeNull();
  });

  it("unterscheidet Lehrperson und Dauer exakt", () => {
    expect(
      satzFuerLektion({ lehrpersonId: "p2", kursartId: "k1", dauerMinuten: 60 }, saetze, 40),
    ).toEqual({ stundensatz: 40, quelle: "DEFAULT" });
  });
});

describe("gruppiereMonatsLektionen", () => {
  const personen = [
    { id: "p1", name: "Anna Muster", kuerzel: "AMUS" },
    { id: "p2", name: "Beat Beispiel", kuerzel: null },
  ];
  const saetze: MatrixSatz[] = [{ lehrpersonId: "p1", kursartId: "k1", minuten: 60, stundensatz: 55 }];

  it("gruppiert pro Lehrperson, summiert und sortiert nach Datum", () => {
    const lektionen = [
      {
        id: "l2",
        lehrpersonId: "p1",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-10 17:00:00",
        kursCode: "DEU-B1-6ER-TEST01-01",
        kursBezeichnung: "Deutsch B1 · 6er",
      },
      {
        id: "l1",
        lehrpersonId: "p1",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-03 17:00:00",
        kursCode: "DEU-B1-6ER-TEST01-01",
        kursBezeichnung: "Deutsch B1 · 6er",
      },
    ];
    const gruppen = gruppiereMonatsLektionen(lektionen, saetze, 40, personen);
    expect(gruppen).toHaveLength(1);
    const g = gruppen[0];
    expect(g.lehrpersonId).toBe("p1");
    expect(g.kuerzel).toBe("AMUS");
    expect(g.zeilen.map((z) => z.lektionId)).toEqual(["l1", "l2"]);
    expect(g.zeilen[0].datumKey).toBe("2026-08-03");
    // Abweichung p1/k1/60 = 55 CHF/h → je Lektion 55.00
    expect(g.totalChf).toBe(110);
    expect(g.ohneSatz).toBe(0);
  });

  it("mischt Abweichung und Default und zählt Zeilen ohne Satz", () => {
    const lektionen = [
      {
        id: "l1",
        lehrpersonId: "p1",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-03 17:00:00",
        kursCode: "C1",
        kursBezeichnung: "Kurs C1",
      },
      {
        id: "l2",
        lehrpersonId: "p1",
        kursartId: "k9",
        dauerMinuten: 45,
        startAt: "2026-08-04 17:00:00",
        kursCode: "C2",
        kursBezeichnung: "Kurs C2",
      },
      {
        id: "l3",
        lehrpersonId: "p2",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-05 17:00:00",
        kursCode: "C3",
        kursBezeichnung: "Kurs C3",
      },
      {
        id: "l4",
        lehrpersonId: null,
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-06 17:00:00",
        kursCode: "C4",
        kursBezeichnung: "Kurs C4",
      },
    ];
    const gruppen = gruppiereMonatsLektionen(lektionen, saetze, 40, personen);
    expect(gruppen.map((g) => g.lehrpersonId)).toEqual(["p1", "p2"]); // Name sortiert
    const anna = gruppen.find((g) => g.lehrpersonId === "p1")!;
    expect(anna.zeilen[0].betragChf).toBe(55); // Abweichung
    expect(anna.zeilen[1].betragChf).toBe(30); // Default 40 CHF/h × 45 Min
    expect(anna.totalChf).toBe(85);
    const beat = gruppen.find((g) => g.lehrpersonId === "p2")!;
    expect(beat.zeilen[0].betragChf).toBe(40); // Default
    // Lektion ohne Lehrperson erscheint nirgends
    expect(gruppen.flatMap((g) => g.zeilen.map((z) => z.lektionId))).not.toContain("l4");
  });

  it("warnt (betragChf null), wenn weder Abweichung noch Default gepflegt sind", () => {
    const lektionen = [
      {
        id: "l1",
        lehrpersonId: "p1",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-03 17:00:00",
        kursCode: "C1",
        kursBezeichnung: "Kurs C1",
      },
    ];
    // Default-Satz noch nicht gesetzt (Erstinbetriebnahme)
    const gruppen = gruppiereMonatsLektionen(lektionen, [], null, personen);
    expect(gruppen[0].zeilen[0].betragChf).toBeNull();
    expect(gruppen[0].zeilen[0].stundensatz).toBeNull();
    expect(gruppen[0].ohneSatz).toBe(1);
    expect(gruppen[0].totalChf).toBe(0);
  });

  it("setzt den Namen der gelöschten Lehrperson nicht fälschlich", () => {
    const lektionen = [
      {
        id: "l1",
        lehrpersonId: "weg",
        kursartId: "k1",
        dauerMinuten: 60,
        startAt: "2026-08-03 17:00:00",
        kursCode: "C1",
        kursBezeichnung: "Kurs C1",
      },
    ];
    expect(gruppiereMonatsLektionen(lektionen, saetze, 40, personen)).toHaveLength(0);
  });
});

describe("Monatsschlüssel", () => {
  it("validiert und wandelt", () => {
    expect(istMonatKey("2026-08")).toBe(true);
    expect(istMonatKey("2026-13")).toBe(false);
    expect(istMonatKey("2026-8")).toBe(false);
    expect(vorigerMonat("2026-01")).toBe("2025-12");
    expect(vorigerMonat("2026-08")).toBe("2026-07");
    expect(naechsterMonat("2026-12")).toBe("2027-01");
    expect(naechsterMonat("2026-08")).toBe("2026-09");
    expect(monatLabel("2026-08")).toBe("August 2026");
  });
});

describe("formatChf", () => {
  it("formatiert mit zwei Nachkommastellen und Apostroph", () => {
    expect(formatChf(45)).toBe("45.00");
    expect(formatChf(1234.5)).toBe("1’234.50");
    expect(formatChf(31.9)).toBe("31.90");
  });
});
