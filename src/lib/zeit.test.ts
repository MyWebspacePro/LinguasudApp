import { describe, expect, it } from "vitest";
import {
  SCHUL_ZEITZONE,
  addDays,
  dateKeyOf,
  formatDatum,
  formatDatumKurz,
  tageZwischen,
  timeFromMinutes,
  utcToZoned,
  weekdayOfDateKey,
  zonedTimeToUtc,
} from "./zeit";

describe("zeit — Zeitzonen-Konvertierung Europe/Zurich", () => {
  it("liefert Sommerzeit-Offset (CEST, UTC+2) für Julitermine", () => {
    const utc = zonedTimeToUtc("2026-07-15", "18:00");
    expect(utc.toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("liefert Winterzeit-Offset (CET, UTC+1) für Januartermine", () => {
    const utc = zonedTimeToUtc("2026-01-15", "18:00");
    expect(utc.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("rund-trippt Instant ↔ Lokalzeit über die Jahresgrenze", () => {
    for (const [dateKey, time] of [
      ["2026-03-28", "20:00"],
      ["2026-03-29", "20:00"], // Tag nach dem DST-Wechsel
      ["2026-10-24", "06:30"],
      ["2026-10-26", "21:30"], // Tag nach dem Rückwechsel am 25.10.
    ] as const) {
      const utc = zonedTimeToUtc(dateKey, time);
      expect(dateKeyOf(utc)).toBe(dateKey);
      const [h, m] = time.split(":").map(Number) as [number, number];
      expect(utcToZoned(utc).minuteOfDay).toBe(h * 60 + m);
    }
  });

  it("behält die Wanduhrzeit über den Rückwechsel bei (25.10.2026, ab 03:00 CET)", () => {
    // 18:00 Lokalzeit am Wechseltag liegt nach dem Rückwechsel → CET (UTC+1)
    expect(zonedTimeToUtc("2026-10-25", "18:00").toISOString()).toBe("2026-10-25T17:00:00.000Z");
    // Letzte unzweideutige CEST-Minute (00:59 Lokalzeit → UTC+2)
    expect(zonedTimeToUtc("2026-10-25", "00:59").toISOString()).toBe("2026-10-24T22:59:00.000Z");
  });

  it("löst die doppelte Stunde am Rückwechsel deterministisch auf (CET)", () => {
    // Lokale 02:30 existiert zweimal; Schulzeiten (06:30–23:00) sind nie betroffen.
    expect(zonedTimeToUtc("2026-10-25", "02:30").toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });
});

describe("zeit — Kalender auf Date-Keys", () => {
  it("weekdayOfDateKey: 1=Montag … 7=Sonntag", () => {
    expect(weekdayOfDateKey("2026-10-26")).toBe(1); // Montag
    expect(weekdayOfDateKey("2026-10-31")).toBe(6); // Samstag
    expect(weekdayOfDateKey("2026-11-01")).toBe(7); // Sonntag
  });

  it("addDays über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("tageZwischen", () => {
    expect(tageZwischen("2026-10-24", "2026-11-07")).toBe(14);
    expect(tageZwischen("2026-11-07", "2026-10-24")).toBe(-14);
  });

  it("Format-Helfer", () => {
    expect(formatDatum("2026-10-26")).toBe("26.10.2026");
    expect(formatDatumKurz("2026-10-26")).toBe("Mo, 26.10.");
  });

  it("timeFromMinutes normalisiert", () => {
    expect(timeFromMinutes(390)).toBe("06:30");
    expect(timeFromMinutes(1380)).toBe("23:00");
    expect(timeFromMinutes(1440)).toBe("00:00");
  });
});

describe("zeit — Standard-Zeitzone", () => {
  it("ist Europe/Zurich", () => {
    expect(SCHUL_ZEITZONE).toBe("Europe/Zurich");
  });
});
