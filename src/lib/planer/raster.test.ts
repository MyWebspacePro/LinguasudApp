import { describe, expect, it } from "vitest";
import { PLAN_FENSTER, blockHoehe, blockTop, planTage, stundenLinien } from "./raster";

describe("raster", () => {
  it("Fenster ist 06:30–23:00", () => {
    expect(PLAN_FENSTER.vonMinute).toBe(390);
    expect(PLAN_FENSTER.bisMinute).toBe(1380);
  });

  it("blockTop positioniert relativ zum Fensterstart", () => {
    expect(blockTop(6 * 60 + 30)).toBe(0);
    expect(blockTop(18 * 60)).toBe(690);
  });

  it("blockHoehe skaliert die Dauer", () => {
    expect(blockHoehe(60)).toBe(60);
    expect(blockHoehe(45)).toBe(45);
  });

  it("stundenLinien liegen auf halben/ganzen Stunden im Fenster", () => {
    const linien = stundenLinien();
    expect(linien[0]).toBe(7 * 60);
    expect(linien[linien.length - 1]).toBe(22 * 60);
  });
});

describe("planTage", () => {
  it("liefert Mo–Sa-Tage im 14-Tage-Horizont (Sonntag ausgeschlossen)", () => {
    const tage = planTage("2026-10-26"); // Montag
    expect(tage[0]).toBe("2026-10-26");
    expect(tage).not.toContain("2026-11-01"); // Sonntag
    expect(tage).toHaveLength(12); // 2 Wochen × 6 Tage
  });

  it("beginnt mitten in der Woche", () => {
    const tage = planTage("2026-10-29"); // Donnerstag
    expect(tage[0]).toBe("2026-10-29");
    expect(tage[1]).toBe("2026-10-30");
    expect(tage[2]).toBe("2026-10-31");
    expect(tage[3]).toBe("2026-11-02"); // Montag danach
  });
});
