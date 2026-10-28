// Tests der Büro-Dienstplanungslogik (Modul 8): Wochenstart, Tagesplan-
// Prioritäten (Abwesenheit → Abweichung → Pensum), Urlaubs-Kontingent.

import { describe, expect, it } from "vitest";
import {
  BUERO_URLAUB_DEFAULT_TAGE,
  diensteFuerWochentag,
  istGueltigesZeitfenster,
  jahresSegmente,
  kontingentFuerJahr,
  planDesTages,
  urlaubRest,
  urlaubstageImJahr,
  uhrzeitZuMinuten,
  wochenStart,
  wochenTage,
  type AbwesenheitBereich,
  type DienstBlock,
  type TagesAbweichung,
} from "./logik";

const dienste: DienstBlock[] = [
  { wochentag: 1, startZeit: "08:00", endZeit: "12:00", notiz: "Vormittag" },
  { wochentag: 1, startZeit: "13:30", endZeit: "17:00", notiz: null },
  { wochentag: 3, startZeit: "09:00", endZeit: "13:00", notiz: null },
];

const keineAbweichung: TagesAbweichung | null = null;
const keineAbwesenheiten: AbwesenheitBereich[] = [];

describe("wochenStart / wochenTage", () => {
  it("liefert den Montag der Woche (auch mitten in der Woche)", () => {
    expect(wochenStart("2026-10-28")).toBe("2026-10-26"); // Mittwoch
    expect(wochenStart("2026-10-26")).toBe("2026-10-26"); // Montag
    expect(wochenStart("2026-11-01")).toBe("2026-10-26"); // Sonntag
  });

  it("klemmt am Monats-/Jahreswechsel", () => {
    expect(wochenStart("2026-01-01")).toBe("2025-12-29"); // Donnerstag
    expect(wochenStart("2027-01-01")).toBe("2026-12-28");
  });

  it("wochenTage liefert Mo–So in Folge", () => {
    expect(wochenTage("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});

describe("diensteFuerWochentag", () => {
  it("sortiert die Blöcke des Tages chronologisch", () => {
    const bloecke = diensteFuerWochentag(dienste, 1);
    expect(bloecke.map((b) => b.startZeit)).toEqual(["08:00", "13:30"]);
    expect(diensteFuerWochentag(dienste, 2)).toEqual([]);
  });
});

describe("planDesTages", () => {
  it("nimmt ohne Abweichung/Abwesenheit das Pensum des Wochentags", () => {
    const plan = planDesTages("2026-10-28", dienste, keineAbweichung, keineAbwesenheiten); // Mittwoch
    expect(plan.bloecke.map((b) => b.startZeit)).toEqual(["09:00"]);
    expect(plan.bloecke[0]?.quelle).toBe("PENSUM");
    expect(plan.abwesenheit).toBeNull();
    expect(plan.dienstfrei).toBe(false);
  });

  it("ersetzt das Pensum durch eine abweichende Arbeitszeit", () => {
    const abweichung: TagesAbweichung = {
      art: "ARBEITSZEIT",
      startZeit: "10:00",
      endZeit: "14:00",
      notiz: "später gekommen",
    };
    const plan = planDesTages("2026-10-28", dienste, abweichung, keineAbwesenheiten);
    expect(plan.bloecke).toEqual([
      { startZeit: "10:00", endZeit: "14:00", notiz: "später gekommen", quelle: "ABWEICHUNG" },
    ]);
    expect(plan.dienstfrei).toBe(false);
  });

  it("markiert eine FREI-Abweichung als dienstfrei", () => {
    const abweichung: TagesAbweichung = { art: "FREI", startZeit: null, endZeit: null, notiz: "Gleitzeit-Kompensation" };
    const plan = planDesTages("2026-10-28", dienste, abweichung, keineAbwesenheiten);
    expect(plan.bloecke).toEqual([]);
    expect(plan.dienstfrei).toBe(true);
    expect(plan.abwesenheit).toBeNull();
  });

  it("gibt der Abwesenheit Vorrang vor Abweichung und Pensum", () => {
    const abweichung: TagesAbweichung = { art: "ARBEITSZEIT", startZeit: "06:00", endZeit: "08:00", notiz: null };
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-10-27", bisKey: "2026-10-30", bemerkung: null },
    ];
    const plan = planDesTages("2026-10-28", dienste, abweichung, abwesenheiten);
    expect(plan.abwesenheit).toBe("URLAUB");
    expect(plan.bloecke).toEqual([]);
  });

  it("endet die Abwesenheit tag-genau (bis inklusive)", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "KRANKHEIT", vonKey: "2026-10-27", bisKey: "2026-10-28", bemerkung: null },
    ];
    expect(planDesTages("2026-10-28", dienste, keineAbweichung, abwesenheiten).abwesenheit).toBe("KRANKHEIT");
    const plan29 = planDesTages("2026-10-29", dienste, keineAbweichung, abwesenheiten);
    expect(plan29.abwesenheit).toBeNull();
    // 29.10.2026 ist ein Donnerstag — das Test-Pensum hat dort keinen Block.
    expect(plan29.bloecke).toEqual([]);
  });
});

describe("urlaubstageImJahr", () => {
  it("zählt Kalendertage von URLAUB-Bereichen (inklusive)", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-02-23", bisKey: "2026-02-27", bemerkung: null }, // 5 Tage
      { art: "URLAUB", vonKey: "2026-07-06", bisKey: "2026-07-07", bemerkung: null }, // 2 Tage
    ];
    expect(urlaubstageImJahr(abwesenheiten, 2026)).toBe(7);
  });

  it("klemmt Bereiche am Jahresrand und zählt anteilig in beide Jahre", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-12-28", bisKey: "2027-01-02", bemerkung: null },
    ];
    expect(urlaubstageImJahr(abwesenheiten, 2026)).toBe(4); // 28.–31.12.
    expect(urlaubstageImJahr(abwesenheiten, 2027)).toBe(2); // 1.–2.1.
  });

  it("zählt nur Urlaub — Krankheit/sonstige sind kontingentfrei", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "KRANKHEIT", vonKey: "2026-02-23", bisKey: "2026-02-27", bemerkung: null },
      { art: "SONSTIGE", vonKey: "2026-03-02", bisKey: "2026-03-03", bemerkung: null },
    ];
    expect(urlaubstageImJahr(abwesenheiten, 2026)).toBe(0);
  });

  it("ignoriert unsortierte Bereiche defensiv", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-02-27", bisKey: "2026-02-23", bemerkung: null },
    ];
    expect(urlaubstageImJahr(abwesenheiten, 2026)).toBe(0);
  });
});

describe("kontingentFuerJahr / urlaubRest", () => {
  it("nimmt ohne Eintrag den Default von 20 Tagen", () => {
    expect(BUERO_URLAUB_DEFAULT_TAGE).toBe(20);
    expect(kontingentFuerJahr([], 2026)).toBe(20);
    expect(kontingentFuerJahr([{ jahr: 2025, tage: 25 }], 2026)).toBe(20);
  });

  it("nimmt den anpassbaren Eintrag des Jahres", () => {
    expect(kontingentFuerJahr([{ jahr: 2025, tage: 25 }, { jahr: 2026, tage: 22 }], 2026)).toBe(22);
  });

  it("rechnet den Rest (negativ = überschritten)", () => {
    expect(urlaubRest(12, 20)).toBe(8);
    expect(urlaubRest(21, 20)).toBe(-1);
  });
});

describe("jahresSegmente", () => {
  it("liefert ohne Abwesenheiten genau ein Segment ohne Art über das ganze Jahr", () => {
    expect(jahresSegmente([], 2026)).toEqual([{ vonKey: "2026-01-01", bisKey: "2026-12-31", art: null }]);
  });

  it("fasst zusammenhängende Abwesenheits-Tage zu einem Segment zusammen", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-02-23", bisKey: "2026-02-27", bemerkung: null },
    ];
    expect(jahresSegmente(abwesenheiten, 2026)).toEqual([
      { vonKey: "2026-01-01", bisKey: "2026-02-22", art: null },
      { vonKey: "2026-02-23", bisKey: "2026-02-27", art: "URLAUB" },
      { vonKey: "2026-02-28", bisKey: "2026-12-31", art: null },
    ]);
  });

  it("klemmt Bereiche am Jahresrand auf das jeweilige Jahr", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-12-28", bisKey: "2027-01-02", bemerkung: null },
    ];
    expect(jahresSegmente(abwesenheiten, 2026).at(-1)).toEqual({
      vonKey: "2026-12-28",
      bisKey: "2026-12-31",
      art: "URLAUB",
    });
    expect(jahresSegmente(abwesenheiten, 2027)[0]).toEqual({
      vonKey: "2027-01-01",
      bisKey: "2027-01-02",
      art: "URLAUB",
    });
  });

  it("gibt bei Überlappung der zuerst gelisteten Abwesenheit Vorrang (wie planDesTages)", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-07-06", bisKey: "2026-07-10", bemerkung: null },
      { art: "KRANKHEIT", vonKey: "2026-07-08", bisKey: "2026-07-12", bemerkung: null },
    ];
    expect(jahresSegmente(abwesenheiten, 2026)).toEqual([
      { vonKey: "2026-01-01", bisKey: "2026-07-05", art: null },
      { vonKey: "2026-07-06", bisKey: "2026-07-10", art: "URLAUB" },
      { vonKey: "2026-07-11", bisKey: "2026-07-12", art: "KRANKHEIT" },
      { vonKey: "2026-07-13", bisKey: "2026-12-31", art: null },
    ]);
  });

  it("ignoriert unsortierte Bereiche defensiv", () => {
    const abwesenheiten: AbwesenheitBereich[] = [
      { art: "URLAUB", vonKey: "2026-02-27", bisKey: "2026-02-23", bemerkung: null },
    ];
    expect(jahresSegmente(abwesenheiten, 2026)).toEqual([{ vonKey: "2026-01-01", bisKey: "2026-12-31", art: null }]);
  });

  it("deckt auch das Schaltjahr vollständig ab", () => {
    expect(jahresSegmente([], 2028)).toEqual([{ vonKey: "2028-01-01", bisKey: "2028-12-31", art: null }]);
  });
});

describe("uhrzeitZuMinuten / istGueltigesZeitfenster", () => {
  it("parst HH:mm tolerant", () => {
    expect(uhrzeitZuMinuten("08:30")).toBe(510);
    expect(uhrzeitZuMinuten("8:30")).toBe(510);
    expect(uhrzeitZuMinuten("24:00")).toBeNull();
    expect(uhrzeitZuMinuten("08:60")).toBeNull();
    expect(uhrzeitZuMinuten("8.30")).toBeNull();
  });

  it("verlangt Start strikt vor Ende am selben Tag", () => {
    expect(istGueltigesZeitfenster("08:00", "12:00")).toBe(true);
    expect(istGueltigesZeitfenster("12:00", "12:00")).toBe(false);
    expect(istGueltigesZeitfenster("13:00", "08:00")).toBe(false);
    expect(istGueltigesZeitfenster("08:00", "25:00")).toBe(false);
  });
});
