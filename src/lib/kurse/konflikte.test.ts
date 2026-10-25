import { describe, expect, it } from "vitest";
import { lehrpersonKonflikte, raumKonflikte, type PlanLektion } from "./konflikte";

const basis: Omit<PlanLektion, "id"> = {
  raumId: "r1",
  startMinute: 18 * 60,
  dauerMinuten: 60,
  lehrpersonId: "p1",
  ueberbuchbar: false,
};

function lektion(id: string, ueber: Partial<PlanLektion> = {}): PlanLektion {
  return { id, ...basis, ...ueber };
}

describe("raumKonflikte", () => {
  it("markiert echte Überschneidungen im selben Raum", () => {
    const a = lektion("a");
    const b = lektion("b", { startMinute: 18 * 60 + 30, lehrpersonId: "p2" });
    expect(raumKonflikte([a, b])).toEqual(new Set(["a", "b"]));
  });

  it("angrenzende Blöcke sind kein Konflikt", () => {
    const a = lektion("a");
    const b = lektion("b", { startMinute: 19 * 60, lehrpersonId: "p2" });
    expect(raumKonflikte([a, b])).toEqual(new Set());
  });

  it("verschiedene Räume kollidieren nicht", () => {
    const a = lektion("a");
    const b = lektion("b", { raumId: "r2", lehrpersonId: "p2" });
    expect(raumKonflikte([a, b])).toEqual(new Set());
  });

  it("pausierte/überbuchbare Lektionen erzeugen keinen Konflikt", () => {
    const a = lektion("a");
    const pausiert = lektion("p", { ueberbuchbar: true, lehrpersonId: "p2" });
    expect(raumKonflikte([a, pausiert])).toEqual(new Set());
  });

  it("Lektionen ohne Raum werden ignoriert", () => {
    const a = lektion("a", { raumId: null });
    const b = lektion("b", { raumId: null });
    expect(raumKonflikte([a, b])).toEqual(new Set());
  });
});

describe("lehrpersonKonflikte", () => {
  it("markiert Doppel-Einsatz derselben Lehrperson", () => {
    const a = lektion("a");
    const b = lektion("b", { raumId: "r2", startMinute: 18 * 60 + 15 });
    expect(lehrpersonKonflikte([a, b])).toEqual(new Set(["a", "b"]));
  });

  it("überbuchbare Kurse kollidieren nicht", () => {
    const a = lektion("a");
    const pausiert = lektion("p", { raumId: "r2", startMinute: 18 * 60 + 15, ueberbuchbar: true });
    expect(lehrpersonKonflikte([a, pausiert])).toEqual(new Set());
  });
});
