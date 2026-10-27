import { describe, expect, it } from "vitest";

import { faelligkeitsSortKey, istAufgabeUeberfaellig } from "./logik";

describe("istAufgabeUeberfaellig", () => {
  it("offen + Fälligkeit vor heute = überfällig", () => {
    expect(istAufgabeUeberfaellig({ status: "OFFEN", faelligAm: "2026-10-26" }, "2026-10-27")).toBe(true);
  });
  it("Fälligkeit heute oder später = nicht überfällig", () => {
    expect(istAufgabeUeberfaellig({ status: "OFFEN", faelligAm: "2026-10-27" }, "2026-10-27")).toBe(false);
    expect(istAufgabeUeberfaellig({ status: "OFFEN", faelligAm: "2026-10-28" }, "2026-10-27")).toBe(false);
  });
  it("erledigt oder ohne Fälligkeit = nie überfällig", () => {
    expect(istAufgabeUeberfaellig({ status: "ERLEDIGT", faelligAm: "2026-01-01" }, "2026-10-27")).toBe(false);
    expect(istAufgabeUeberfaellig({ status: "OFFEN", faelligAm: null }, "2026-10-27")).toBe(false);
  });
});

describe("faelligkeitsSortKey", () => {
  it("sortiert überfällige vor kommende vor ohne Fälligkeit", () => {
    const keys = [
      faelligkeitsSortKey({ status: "OFFEN", faelligAm: null }),
      faelligkeitsSortKey({ status: "OFFEN", faelligAm: "2026-10-20" }),
      faelligkeitsSortKey({ status: "OFFEN", faelligAm: "2026-11-01" }),
    ];
    expect([...keys].sort((a, b) => a - b)).toEqual([keys[1], keys[2], keys[0]]);
  });
});
