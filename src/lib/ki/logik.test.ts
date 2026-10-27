import { describe, expect, it } from "vitest";
import {
  ablaufSumme,
  bauePrompt,
  baueTitel,
  istKeyGesetzt,
  KI_MAX_DAUER_MINUTEN,
  KI_MAX_PROMPT,
  maskiereKey,
  parseKiErgebnis,
  pruefeParameter,
  themaAuszug,
  type KiParameterFrei,
  type KiParameterStruktur,
} from "./logik";

const struktur: KiParameterStruktur = {
  sprache: "Portugiesisch",
  niveau: "B1",
  kursart: "4er",
  dauerMinuten: 60,
  lernziele: ["Vergangenheitsformen anwenden", "Über Ferien sprechen"],
  zusatzhinweise: "Fokus auf Sprechen",
};

const frei: KiParameterFrei = { prompt: "Erstelle eine Lektion zum Thema «Am Bahnhof» für A2 mit Dialogen." };

describe("pruefeParameter", () => {
  it("akzeptiert gültige strukturierte Eingaben", () => {
    expect(pruefeParameter("STRUKTUR", struktur)).toEqual({});
  });

  it("meldet fehlende Sprache und Niveau", () => {
    const fehler = pruefeParameter("STRUKTUR", { ...struktur, sprache: "", niveau: "" });
    expect(fehler.sprache).toBeTruthy();
    expect(fehler.niveau).toBeTruthy();
  });

  it("begrenzt die Dauer", () => {
    expect(pruefeParameter("STRUKTUR", { ...struktur, dauerMinuten: 5 }).dauerMinuten).toBeTruthy();
    expect(
      pruefeParameter("STRUKTUR", { ...struktur, dauerMinuten: KI_MAX_DAUER_MINUTEN + 1 }).dauerMinuten,
    ).toBeTruthy();
  });

  it("akzeptiert gültige freie Prompts", () => {
    expect(pruefeParameter("FREI", frei)).toEqual({});
  });

  it("lehnt zu kurze und zu lange freie Prompts ab", () => {
    expect(pruefeParameter("FREI", { prompt: "kurz" }).prompt).toBeTruthy();
    expect(pruefeParameter("FREI", { prompt: "x".repeat(KI_MAX_PROMPT + 1) }).prompt).toBeTruthy();
  });
});

describe("bauePrompt", () => {
  it("baut den strukturierten Prompt mit Sprache, Niveau und Zielen", () => {
    const { system, user } = bauePrompt("STRUKTUR", struktur);
    expect(system).toContain("JSON");
    expect(system).toContain("Schweizer Rechtschreibung");
    expect(user).toContain("Sprache: Portugiesisch");
    expect(user).toContain("Niveau: B1");
    expect(user).toContain("Dauer der Lektion: 60 Minuten");
    expect(user).toContain("1. Vergangenheitsformen anwenden");
    expect(user).toContain("Fokus auf Sprechen");
  });

  it("nutzt im Freimodus den Prompt unverändert als User-Nachricht", () => {
    const { system, user } = bauePrompt("FREI", frei);
    expect(user).toBe(frei.prompt.trim());
    expect(system).toContain('"text"');
  });
});

describe("parseKiErgebnis", () => {
  it("parst strukturiertes JSON inkl. Codezaun", () => {
    const raw = '```json\n{"lernziele":["Ziel A"],"ablauf":[{"phase":"Einstieg","dauerMinuten":10,"beschreibung":"Begrüssung"}],"materialien":["Karten"],"hausaufgabe":"S. 12"}\n```';
    const ergebnis = parseKiErgebnis(raw, "STRUKTUR");
    expect(ergebnis).toEqual({
      lernziele: ["Ziel A"],
      ablauf: [{ phase: "Einstieg", dauerMinuten: 10, beschreibung: "Begrüssung" }],
      materialien: ["Karten"],
      hausaufgabe: "S. 12",
    });
  });

  it("fällt bei ungültigem JSON auf den Rohtext zurück", () => {
    expect(parseKiErgebnis("kein json", "STRUKTUR")).toEqual({ rohtext: "kein json" });
  });

  it("fällt bei fehlendem Ablauf auf den Rohtext zurück", () => {
    const raw = '{"lernziele":["A"],"ablauf":[],"materialien":[],"hausaufgabe":"x"}';
    expect(parseKiErgebnis(raw, "STRUKTUR")).toEqual({ rohtext: raw });
  });

  it("fällt bei fehlender Hausaufgabe auf den Rohtext zurück", () => {
    const raw = '{"lernziele":["A"],"ablauf":[{"phase":"P","dauerMinuten":10,"beschreibung":"B"}],"materialien":[]}';
    expect(parseKiErgebnis(raw, "STRUKTUR")).toEqual({ rohtext: raw });
  });

  it("fällt bei einem Ablaufschritt ohne Beschreibung auf den Rohtext zurück", () => {
    const raw = '{"lernziele":["A"],"ablauf":[{"phase":"P","dauerMinuten":10}],"materialien":[],"hausaufgabe":"x"}';
    expect(parseKiErgebnis(raw, "STRUKTUR")).toEqual({ rohtext: raw });
  });

  it("findet JSON auch mit Vor- und Nachbemerkungen", () => {
    const raw = 'Hier ist der Plan:\n{"lernziele":["A"],"ablauf":[{"phase":"P","dauerMinuten":10,"beschreibung":"B"}],"materialien":[],"hausaufgabe":"x"}\nViel Erfolg!';
    expect(parseKiErgebnis(raw, "STRUKTUR")).toEqual({
      lernziele: ["A"],
      ablauf: [{ phase: "P", dauerMinuten: 10, beschreibung: "B" }],
      materialien: [],
      hausaufgabe: "x",
    });
  });

  it("parst freien Text", () => {
    expect(parseKiErgebnis('{"text":"Hallo"}', "FREI")).toEqual({ text: "Hallo" });
  });

  it("fällt im Freimodus auf den Rohtext zurück, wenn kein text-Feld vorhanden ist", () => {
    expect(parseKiErgebnis('{"foo":"bar"}', "FREI")).toEqual({ text: '{"foo":"bar"}' });
    expect(parseKiErgebnis("einfacher Text", "FREI")).toEqual({ text: "einfacher Text" });
  });

  it("wirft bei leerer Antwort", () => {
    expect(() => parseKiErgebnis("   ", "FREI")).toThrow(/leere Antwort/);
  });
});

describe("Hilfsfunktionen", () => {
  it("maskiert Keys und erkennt gesetzte Keys", () => {
    expect(maskiereKey(null)).toBe("");
    expect(maskiereKey("sk-or-v1-abcdef1234")).toBe("••••1234");
    expect(maskiereKey("abc")).toBe("••••");
    expect(istKeyGesetzt("kurz")).toBe(false);
    expect(istKeyGesetzt("sk-or-v1-abcdef1234")).toBe(true);
  });

  it("baut Titel und Themenauszug mit Begrenzung", () => {
    expect(baueTitel("STRUKTUR", struktur)).toContain("Portugiesisch B1");
    const langerTitel = baueTitel("FREI", { prompt: "a".repeat(200) });
    expect(langerTitel.length).toBeLessThanOrEqual(80);
    expect(themaAuszug("STRUKTUR", struktur)).toContain("4er");
    expect(themaAuszug("FREI", frei).length).toBeLessThanOrEqual(140);
  });

  it("summiert die Ablaufdauer", () => {
    expect(
      ablaufSumme({
        lernziele: [],
        ablauf: [
          { phase: "A", dauerMinuten: 15, beschreibung: "x" },
          { phase: "B", dauerMinuten: 30, beschreibung: "y" },
        ],
        materialien: [],
        hausaufgabe: "",
      }),
    ).toBe(45);
    expect(ablaufSumme({ text: "frei" })).toBe(0);
  });
});
