import { describe, expect, it } from "vitest";
import {
  autoTarifstufe,
  guthabenStand,
  paketendeErreicht,
  paketendeSchwelle,
  paketFortschritt,
  verbrauchtImPaket,
  type JournalEintrag,
  type TarifstufeOption,
} from "./paket";

const eintrag = (art: JournalEintrag["art"], delta: number, datum: string): JournalEintrag => ({ art, delta, datum });

describe("guthabenStand", () => {
  it("summiert die Journal-Deltas", () => {
    const journal = [
      eintrag("AUFLADUNG", 14, "2026-10-01T00:00:00.000Z"),
      eintrag("VERBRAUCH", -1, "2026-10-05T00:00:00.000Z"),
      eintrag("FEHLZEIT_UNENTSCHULDIGT", -1, "2026-10-06T00:00:00.000Z"),
      eintrag("FEHLZEIT_ENTSCHULDIGT", 0, "2026-10-07T00:00:00.000Z"),
    ];
    expect(guthabenStand(journal)).toBe(12);
  });
});

describe("paketende-Automatik", () => {
  it("Schwelle: 12. von 14 / 13. von 15", () => {
    expect(paketendeSchwelle(14)).toBe(12);
    expect(paketendeSchwelle(15)).toBe(13);
  });

  it("löst bei der 12. von 14 aus", () => {
    expect(paketendeErreicht(11, 14)).toBe(false);
    expect(paketendeErreicht(12, 14)).toBe(true);
    expect(paketendeErreicht(13, 15)).toBe(true);
  });

  it("Fortschritt ist geklemmt", () => {
    expect(paketFortschritt(6, 14)).toBeCloseTo(6 / 14);
    expect(paketFortschritt(20, 14)).toBe(1);
  });
});

describe("verbrauchtImPaket", () => {
  it("zählt nur Verbrauch und unentschuldigte Fehlzeiten seit Paketstart", () => {
    const journal = [
      eintrag("AUFLADUNG", 14, "2026-10-01T00:00:00.000Z"),
      eintrag("VERBRAUCH", -1, "2026-10-05T00:00:00.000Z"),
      eintrag("FEHLZEIT_UNENTSCHULDIGT", -1, "2026-10-06T00:00:00.000Z"),
      eintrag("FEHLZEIT_ENTSCHULDIGT", 0, "2026-10-07T00:00:00.000Z"),
      // Vor dem laufenden Paket (nach Verlängerung):
      eintrag("VERBRAUCH", -1, "2026-09-20T00:00:00.000Z"),
    ];
    expect(verbrauchtImPaket(journal, "2026-10-01T00:00:00.000Z")).toBe(2);
  });
});

describe("autoTarifstufe", () => {
  const hoch: TarifstufeOption = {
    id: "hoch",
    name: "Hochtarif",
    lessonsPerPackage: 14,
    middayFrom: "11:30",
    middayTo: "13:30",
    eveningFrom: "17:00",
  };
  const niedrig: TarifstufeOption = {
    id: "niedrig",
    name: "Niedertarif",
    lessonsPerPackage: 15,
    middayFrom: null,
    middayTo: null,
    eveningFrom: null,
  };

  it("Abendstart → Hochtarif", () => {
    expect(autoTarifstufe("18:00", [hoch, niedrig])?.id).toBe("hoch");
  });

  it("Mittagsfenster → Hochtarif", () => {
    expect(autoTarifstufe("12:00", [hoch, niedrig])?.id).toBe("hoch");
  });

  it("Vormittag/Nachmittag → Niedertarif", () => {
    expect(autoTarifstufe("09:00", [hoch, niedrig])?.id).toBe("niedrig");
    expect(autoTarifstufe("15:00", [hoch, niedrig])?.id).toBe("niedrig");
  });

  it("Fensterränder: ab eveningFrom hoch, kurz davor niedrig", () => {
    expect(autoTarifstufe("17:00", [hoch, niedrig])?.id).toBe("hoch");
    expect(autoTarifstufe("16:59", [hoch, niedrig])?.id).toBe("niedrig");
  });
});
