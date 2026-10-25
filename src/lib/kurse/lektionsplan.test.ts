import { describe, expect, it } from "vitest";
import { geplanteTermine, horizonVonBis } from "./lektionsplan";

const quelle = { wochentag: 2, startZeit: "18:00", dauerMinuten: 60 }; // Dienstags

describe("geplanteTermine", () => {
  it("expandiert wöchentliche Termine über zwei Wochen", () => {
    const termine = geplanteTermine(quelle, "2026-10-26", "2026-11-08");
    expect(termine.map((t) => t.dateKey)).toEqual(["2026-10-27", "2026-11-03"]);
    expect(termine[0]!.startUtcISO).toBe("2026-10-27T17:00:00.000Z"); // CET ab 25.10.
    expect(termine[0]!.dauerMinuten).toBe(60);
  });

  it("erster Termin liegt noch im Startzeitraum, wenn der Wochentag passt", () => {
    const termine = geplanteTermine(quelle, "2026-10-27", "2026-10-27");
    expect(termine).toHaveLength(1);
  });

  it("lässt Tage innerhalb einer Unterbrechung weg", () => {
    const termine = geplanteTermine(quelle, "2026-10-26", "2026-11-08", [
      { vonKey: "2026-10-26", bisKey: "2026-11-01" },
    ]);
    expect(termine.map((t) => t.dateKey)).toEqual(["2026-11-03"]);
  });

  it("Sonntag-Quelle wird abgelehnt (Planer Mo–Sa)", () => {
    expect(geplanteTermine({ wochentag: 7, startZeit: "10:00", dauerMinuten: 45 }, "2026-10-26", "2026-11-08")).toEqual([]);
  });

  it("Sommerzeit-Expansion liefert UTC−2", () => {
    const termine = geplanteTermine(quelle, "2026-07-01", "2026-07-31");
    expect(termine.map((t) => t.dateKey)).toEqual(["2026-07-07", "2026-07-14", "2026-07-21", "2026-07-28"]);
    expect(termine[0]!.startUtcISO).toBe("2026-07-07T16:00:00.000Z");
  });
});

describe("horizonVonBis", () => {
  it("zwei Wochen im Voraus ab heute", () => {
    expect(horizonVonBis("2026-10-24")).toEqual({ vonKey: "2026-10-24", bisKey: "2026-11-07" });
  });

  it("mit Offset (z.B. ab morgen)", () => {
    expect(horizonVonBis("2026-10-24", 14, 1)).toEqual({ vonKey: "2026-10-25", bisKey: "2026-11-07" });
  });
});
