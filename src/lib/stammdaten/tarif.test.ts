import { describe, expect, it } from "vitest";
import { isHochtarifZeit, normalizeTimeInput, timeToMinutes } from "./tarif";

const FENSTER = { middayFrom: "11:30", middayTo: "13:30", eveningFrom: "17:00" };
const at = (h: number, m: number) => h * 60 + m;

describe("timeToMinutes", () => {
  it("parst HH:mm", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("11:30")).toBe(690);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("lehrt ungültige Werte ab", () => {
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("7:5")).toBeNull();
    expect(timeToMinutes(null)).toBeNull();
    expect(timeToMinutes("abc")).toBeNull();
  });
});

describe("isHochtarifZeit", () => {
  it("Mittagsfenster gilt als Hochtarif", () => {
    expect(isHochtarifZeit(at(11, 30), FENSTER)).toBe(true);
    expect(isHochtarifZeit(at(12, 0), FENSTER)).toBe(true);
    expect(isHochtarifZeit(at(13, 29), FENSTER)).toBe(true);
  });

  it("Vormittag/Nachmittag = Niedertarif", () => {
    expect(isHochtarifZeit(at(8, 0), FENSTER)).toBe(false);
    expect(isHochtarifZeit(at(10, 15), FENSTER)).toBe(false);
    expect(isHochtarifZeit(at(14, 0), FENSTER)).toBe(false);
    expect(isHochtarifZeit(at(16, 59), FENSTER)).toBe(false);
  });

  it("Abend ab eveningFrom gilt als Hochtarif", () => {
    expect(isHochtarifZeit(at(17, 0), FENSTER)).toBe(true);
    expect(isHochtarifZeit(at(20, 30), FENSTER)).toBe(true);
  });

  it("Grenzfälle: genau bis/halboffene Fenster", () => {
    expect(isHochtarifZeit(at(13, 30), FENSTER)).toBe(false); // bis ist exklusiv
    expect(isHochtarifZeit(at(11, 29), FENSTER)).toBe(false); // von ist inklusiv
  });

  it("ohne Fenster nie Hochtarif", () => {
    expect(isHochtarifZeit(at(22, 0), { middayFrom: null, middayTo: null, eveningFrom: null })).toBe(false);
  });
});

describe("normalizeTimeInput", () => {
  it("normalisiert lockere Eingaben", () => {
    expect(normalizeTimeInput("9:5")).toBe("09:05");
    expect(normalizeTimeInput("17:00")).toBe("17:00");
    expect(normalizeTimeInput(" 11:30 ")).toBe("11:30");
  });

  it("lehrt ungültige Eingaben ab", () => {
    expect(normalizeTimeInput("25:00")).toBeNull();
    expect(normalizeTimeInput("abc")).toBeNull();
    expect(normalizeTimeInput("7 Uhr")).toBeNull();
  });
});
