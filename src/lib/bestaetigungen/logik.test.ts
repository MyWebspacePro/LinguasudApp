import { describe, expect, it } from "vitest";
import { anredeZeile, briefAnrede, zaehleBesuchteLektionen, zeitraumText } from "./logik";

describe("briefAnrede", () => {
  it("nennt Herren mit Nachname", () => {
    expect(briefAnrede("HERR", "Max Muster")).toBe("Sehr geehrter Herr Muster");
  });

  it("nennt Frauen mit Nachname", () => {
    expect(briefAnrede("FRAU", "Anna Beispiel")).toBe("Sehr geehrte Frau Beispiel");
  });

  it("verwendet bei divers den vollen Namen", () => {
    expect(briefAnrede("DIVERS", "Alex Flo Schmid")).toBe("Guten Tag Alex Flo Schmid");
  });

  it("fällt bei fehlendem Nachname auf den vollen Namen zurück", () => {
    expect(briefAnrede("FRAU", "Madonna")).toBe("Sehr geehrte Frau Madonna");
  });
});

describe("anredeZeile", () => {
  it("stellt Anrede + Namen für den Adressblock", () => {
    expect(anredeZeile("FRAU", "Anna Beispiel")).toBe("Frau Anna Beispiel");
    expect(anredeZeile("HERR", "Max Muster")).toBe("Herr Max Muster");
    expect(anredeZeile("DIVERS", "Alex Schmid")).toBe("Alex Schmid");
  });
});

describe("zaehleBesuchteLektionen", () => {
  const lektionen = [
    { id: "l1", startAt: "2026-08-03 17:00:00" }, // Mo im Abschnitt
    { id: "l2", startAt: "2026-08-10 17:00:00" }, // im Abschnitt
    { id: "l3", startAt: "2026-10-23 17:00:00" }, // letzter Tag des Abschnitts (inklusive)
    { id: "l4", startAt: "2026-10-24 17:00:00" }, // erster Tag des neuen Abschnitts
    { id: "l5", startAt: "2026-07-27 17:00:00" }, // vor dem Abschnitt
  ];
  const anwesenheiten = [
    { lektionId: "l1", anmeldungId: "a1" },
    { lektionId: "l2", anmeldungId: "a1" },
    { lektionId: "l3", anmeldungId: "a1" },
    { lektionId: "l4", anmeldungId: "a1" }, // Lektion ausserhalb → zählt nicht
    { lektionId: "l1", anmeldungId: "a2" },
  ];

  it("zählt nur Anwesenheiten in Lektionen des Zeitraums (Grenzen inklusive)", () => {
    const zahlen = zaehleBesuchteLektionen(lektionen, anwesenheiten, "2026-08-01", "2026-10-23");
    expect(zahlen.get("a1")).toBe(3);
    expect(zahlen.get("a2")).toBe(1);
  });

  it("ignoriert Lektionen vor und nach dem Abschnitt", () => {
    const zahlen = zaehleBesuchteLektionen(lektionen, anwesenheiten, "2026-09-01", "2026-09-30");
    expect(zahlen.size).toBe(0);
  });

  it("zählt um Mitternacht UTC korrekt zum Lokaltag (Spitzenstunde → Lokalabend)", () => {
    // 23:00 UTC = 01:00 am Folgetag im Herbst (CET +1): Lokaltag 2026-10-24.
    const nachts = [{ id: "n1", startAt: "2026-10-23 23:00:00" }];
    const zahlen = zaehleBesuchteLektionen(nachts, [{ lektionId: "n1", anmeldungId: "a1" }], "2026-08-01", "2026-10-23");
    expect(zahlen.size).toBe(0);
    const zahlenTagsDanach = zaehleBesuchteLektionen(nachts, [{ lektionId: "n1", anmeldungId: "a1" }], "2026-10-24", "2026-11-30");
    expect(zahlenTagsDanach.get("a1")).toBe(1);
  });
});

describe("zeitraumText", () => {
  it("formatiert von–bis als tt.mm.jjjj", () => {
    expect(zeitraumText("2026-08-01", "2026-10-23")).toBe("01.08.2026 – 23.10.2026");
  });
});
