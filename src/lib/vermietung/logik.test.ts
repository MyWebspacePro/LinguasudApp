import { describe, expect, it } from "vitest";
import {
  dauerMinutenAusZeitfenster,
  istImPlanerFenster,
  serienTermine,
  ueberlappt,
  vermietungsPositionText,
} from "./logik";

describe("dauerMinutenAusZeitfenster", () => {
  it("rechnet das Zeitfenster in Minuten hoch", () => {
    expect(dauerMinutenAusZeitfenster("18:00", "20:00")).toBe(120);
    expect(dauerMinutenAusZeitfenster("06:30", "07:00")).toBe(30);
    expect(dauerMinutenAusZeitfenster("9:15", "10:45")).toBe(90);
  });

  it("lehnt ungültige und umgekehrte Fenster ab", () => {
    expect(dauerMinutenAusZeitfenster("20:00", "18:00")).toBeNull();
    expect(dauerMinutenAusZeitfenster("18:00", "18:00")).toBeNull();
    expect(dauerMinutenAusZeitfenster("18:00", "")).toBeNull();
    expect(dauerMinutenAusZeitfenster("", "20:00")).toBeNull();
    expect(dauerMinutenAusZeitfenster("aaa", "20:00")).toBeNull();
  });
});

describe("istImPlanerFenster", () => {
  it("akzeptiert das Planer-Raster 06:30–23:00", () => {
    expect(istImPlanerFenster("06:30", "08:00")).toBe(true);
    expect(istImPlanerFenster("18:00", "20:00")).toBe(true);
    expect(istImPlanerFenster("20:00", "23:00")).toBe(true);
  });

  it("lehnt Fenster ausserhalb des Rasters ab", () => {
    expect(istImPlanerFenster("06:00", "08:00")).toBe(false);
    expect(istImPlanerFenster("20:00", "23:30")).toBe(false);
    expect(istImPlanerFenster("23:00", "23:30")).toBe(false);
  });
});

describe("serienTermine", () => {
  it("listet alle Diensttage im Zeitraum (inklusive Grenzen)", () => {
    // 1.1.2026 ist ein Donnerstag — Diensttage im Januar 2026: 6/13/20/27.
    expect(serienTermine(2, "2026-01-01", "2026-01-31")).toEqual([
      "2026-01-06",
      "2026-01-13",
      "2026-01-20",
      "2026-01-27",
    ]);
  });

  it("ist DST-sicher (Kalendertage statt Stunden)", () => {
    // CET→CEST-Wechsel am 29.3.2026: Montage bleiben Montage.
    expect(serienTermine(1, "2026-03-23", "2026-04-06")).toEqual([
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
    ]);
    // CEST→CET am 25.10.2026: Freitage bleiben Freitage.
    expect(serienTermine(5, "2026-10-23", "2026-11-06")).toEqual([
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
    ]);
  });

  it("zählt Grenztage mit, wenn sie selbst auf den Wochentag fallen", () => {
    // 27.10.2026 ist ein Dienstag.
    expect(serienTermine(2, "2026-10-27", "2026-10-27")).toEqual(["2026-10-27"]);
  });

  it("liefert nichts bei ungültigem Wochentag oder umgekehrtem Zeitraum", () => {
    expect(serienTermine(0, "2026-01-01", "2026-01-31")).toEqual([]);
    expect(serienTermine(8, "2026-01-01", "2026-01-31")).toEqual([]);
    expect(serienTermine(2, "2026-02-01", "2026-01-01")).toEqual([]);
  });
});

describe("vermietungsPositionText", () => {
  it("formuliert die Rechnungs-Position", () => {
    expect(vermietungsPositionText("Oxford", "2026-10-28", "18:00", "20:00")).toBe(
      "Raumvermietung «Oxford» · 28.10.2026 · 18:00–20:00",
    );
  });
});

describe("ueberlappt", () => {
  it("markiert echte Überschneidungen, nicht aber Kantenberührung", () => {
    expect(ueberlappt(18 * 60, 20 * 60, 19 * 60, 21 * 60)).toBe(true);
    expect(ueberlappt(18 * 60, 20 * 60, 17 * 60, 18 * 60 + 30)).toBe(true);
    expect(ueberlappt(18 * 60, 20 * 60, 20 * 60, 22 * 60)).toBe(false); // Kante
    expect(ueberlappt(18 * 60, 20 * 60, 16 * 60, 18 * 60)).toBe(false); // Kante
    expect(ueberlappt(18 * 60, 20 * 60, 21 * 60, 22 * 60)).toBe(false);
  });
});
