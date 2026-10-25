// Tests der Anwesenheitslogik (Modul 7): 24-h-Fenster, Deltas, Probe-Regel,
// Vollständigkeit, Lektionsende-Tag.

import { describe, expect, it } from "vitest";
import {
  ANWESENHEIT_FENSTER_STUNDEN,
  deltaVonAnwesenheit,
  fensterEndeDbTime,
  istFensterAbgelaufen,
  istVollstaendigErfasst,
  journalArtVonAnwesenheit,
  lektionsEndeDateKey,
} from "./logik";
import { fromDbTime, toDbTime } from "@/lib/domain";

describe("deltaVonAnwesenheit", () => {
  it("bucht anwesend −1, unentschuldigt −1 und entschuldigt −0", () => {
    expect(deltaVonAnwesenheit("ANWESEND")).toBe(-1);
    expect(deltaVonAnwesenheit("ABWESEND_UNENTSCHULDIGT")).toBe(-1);
    expect(deltaVonAnwesenheit("ABWESEND_ENTSCHULDIGT")).toBe(0);
  });
});

describe("journalArtVonAnwesenheit", () => {
  it("ordnet die Journal-Arten laut Pflichtenheft", () => {
    expect(journalArtVonAnwesenheit("ANWESEND")).toBe("VERBRAUCH");
    expect(journalArtVonAnwesenheit("ABWESEND_UNENTSCHULDIGT")).toBe("FEHLZEIT_UNENTSCHULDIGT");
    expect(journalArtVonAnwesenheit("ABWESEND_ENTSCHULDIGT")).toBe("FEHLZEIT_ENTSCHULDIGT");
  });
});

describe("24-h-Fenster", () => {
  // 27.10.2026 18:00–19:00 Zurich (CEST, UTC+2) → Ende 17:00 UTC.
  const ende = new Date("2026-10-27T17:00:00Z");

  it("Konstante ist 24 Stunden", () => {
    expect(ANWESENHEIT_FENSTER_STUNDEN).toBe(24);
  });

  it("Fensterende liegt 24 h nach dem Lektionsende", () => {
    const endeDb = toDbTime(ende);
    expect(istFensterAbgelaufen(endeDb, new Date("2026-10-28T16:59:00Z").getTime())).toBe(false);
    expect(istFensterAbgelaufen(endeDb, new Date("2026-10-28T17:00:00Z").getTime())).toBe(true);
  });

  it("fensterEndeDbTime liefert dieselbe Grenze", () => {
    expect(fensterEndeDbTime(ende)).toBe("2026-10-28T17:00:00.000Z");
    // Grenze anhand des DB-Rohformats bestätigen: 24 h nach Lektionsende.
    expect(ende.getTime() + 24 * 3_600_000).toBe(fromDbTime("2026-10-28 17:00:00.000").getTime());
  });

  it("akzeptiert DB-Rohformat ohne Zeitzonen-Marker", () => {
    // DB liefert "2026-10-27 17:00:00.000" (UTC, ohne Z) — gleiche Grenze.
    expect(istFensterAbgelaufen("2026-10-27 17:00:00.000", new Date("2026-10-28T16:00:00Z").getTime())).toBe(false);
    expect(istFensterAbgelaufen("2026-10-27 17:00:00.000", new Date("2026-10-28T18:00:00Z").getTime())).toBe(true);
    expect(fromDbTime("2026-10-27 17:00:00.000").toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });
});

describe("istVollstaendigErfasst", () => {
  const anmeldungen = [
    { id: "a1", status: "AKTIV" },
    { id: "a2", status: "AKTIV" },
    { id: "p1", status: "PROBE" },
    { id: "b1", status: "BEENDET" },
  ];

  it("ist vollständig, wenn alle AKTIV erfasst sind (Probe/Beendet zählen nicht als Pflicht)", () => {
    const erfasst = new Map([
      ["a1", "ANWESEND"],
      ["a2", "ABWESEND_ENTSCHULDIGT"],
    ] as const);
    expect(istVollstaendigErfasst(anmeldungen, erfasst)).toBe(true);
  });

  it("ist unvollständig, wenn eine aktive Anmeldung fehlt", () => {
    const erfasst = new Map([["a1", "ANWESEND"]] as const);
    expect(istVollstaendigErfasst(anmeldungen, erfasst)).toBe(false);
  });

  it("ist unvollständig bei gar keiner Erfassung", () => {
    expect(istVollstaendigErfasst(anmeldungen, new Map())).toBe(false);
  });
});

describe("lektionsEndeDateKey", () => {
  it("liefert den Lokal-Tag des Endes (Zürich) — auch nach Mitternacht", () => {
    // 27.10.2026 ist CET (UTC+1): 22:30 UTC = 23:30 Zürich + 60 min = 28.10. 00:30.
    expect(lektionsEndeDateKey("2026-10-27T22:30:00Z", 60)).toBe("2026-10-28");
    // Endet vor Mitternacht: 27.10. 19:00 UTC = 20:00 Zürich + 45 min → 27.10.
    expect(lektionsEndeDateKey("2026-10-27T19:00:00Z", 45)).toBe("2026-10-27");
  });
});
