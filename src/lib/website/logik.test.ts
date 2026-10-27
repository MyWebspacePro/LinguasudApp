// Unit-Tests der Website-Domänenlogik (Modul 15): Slug-Regeln, Pop-up-
// Zeitfenster, freie Plätze in Gruppenkursen und Inhalts-Parser.

import { describe, expect, it } from "vitest";

import {
  formatiereKursTermin,
  freiePlaetze,
  istGruppenkurs,
  istGueltigerSlug,
  istSlugVerboten,
  parseInhalt,
  plaetzeLabel,
  sprachenSlug,
  waehlePopup,
  wirdAngezeigt,
  type KursPlatzLage,
  type PopupKandidat,
} from "./logik";

const MINUTE = 60_000;

describe("Slugs", () => {
  it("leitet Sprach-Slugs mit Umlauten ab", () => {
    expect(sprachenSlug("Deutsch")).toBe("sprachen/deutsch");
    expect(sprachenSlug("Französisch")).toBe("sprachen/franzoesisch");
    expect(sprachenSlug("Spanisch")).toBe("sprachen/spanisch");
  });

  it("akzeptiert nur saubere Pfad-Slugs", () => {
    expect(istGueltigerSlug("ueber-uns")).toBe(true);
    expect(istGueltigerSlug("sprachen/weitere")).toBe(true);
    expect(istGueltigerSlug("Über uns")).toBe(false);
    expect(istGueltigerSlug("a//b")).toBe(false);
    expect(istGueltigerSlug("")).toBe(false);
  });

  it("sperrt reservierte Pfade", () => {
    expect(istSlugVerboten("anfrage")).toBe(true);
    expect(istSlugVerboten("en")).toBe(true);
    expect(istSlugVerboten("sprachen")).toBe(true);
    expect(istSlugVerboten("ueber-uns")).toBe(false);
    // «sprachen/weitere» ist erlaubt — nur das Root-Wort «sprachen» ist gesperrt.
    expect(istGueltigerSlug("sprachen/weitere")).toBe(true);
  });
});

describe("Pop-up-Zeitfenster", () => {
  const jetzt = 1_000_000 * MINUTE;

  const kandidat = (p: Partial<PopupKandidat>): PopupKandidat => ({
    id: "p1",
    aktiv: true,
    gueltigVon: null,
    gueltigBis: null,
    ...p,
  });

  it("zeigt aktive Pop-ups ohne Zeitfenster", () => {
    expect(waehlePopup([kandidat({})], jetzt)?.id).toBe("p1");
  });

  it("ignoriert inaktive Pop-ups", () => {
    expect(waehlePopup([kandidat({ aktiv: false })], jetzt)).toBeNull();
  });

  it("respektiert «von» und «bis» (Grenzen inklusive)", () => {
    expect(waehlePopup([kandidat({ gueltigVon: jetzt })], jetzt)?.id).toBe("p1");
    expect(waehlePopup([kandidat({ gueltigVon: jetzt + MINUTE })], jetzt)).toBeNull();
    expect(waehlePopup([kandidat({ gueltigBis: jetzt })], jetzt)?.id).toBe("p1");
    expect(waehlePopup([kandidat({ gueltigBis: jetzt - MINUTE })], jetzt)).toBeNull();
  });

  it("wählt bei mehreren Kandidaten den spätesten Start", () => {
    const alt = kandidat({ id: "alt", gueltigVon: jetzt - 10 * MINUTE });
    const neu = kandidat({ id: "neu", gueltigVon: jetzt - 5 * MINUTE });
    expect(waehlePopup([alt, neu], jetzt)?.id).toBe("neu");
  });

  it("bevorzugt datierte Pop-ups vor undatierten", () => {
    const undatiert = kandidat({ id: "undatiert" });
    const datiert = kandidat({ id: "datiert", gueltigVon: jetzt - MINUTE });
    expect(waehlePopup([undatiert, datiert], jetzt)?.id).toBe("datiert");
  });
});

describe("Freie Plätze", () => {
  const lage = (max: number | null, belegt: number): KursPlatzLage => ({ maxTeilnehmende: max, belegt });

  it("erkennt Gruppenkurse (≥ 2 Plätze)", () => {
    expect(istGruppenkurs(lage(6, 3))).toBe(true);
    expect(istGruppenkurs(lage(1, 0))).toBe(false); // Einzelunterricht
    expect(istGruppenkurs(lage(null, 0))).toBe(false); // Firmenkurs (individuell)
  });

  it("zählt freie Plätze und blendet volle Kurse aus", () => {
    expect(freiePlaetze(lage(6, 4))).toBe(2);
    expect(freiePlaetze(lage(6, 6))).toBe(0);
    expect(freiePlaetze(lage(6, 7))).toBe(0); // übervoll nie negativ
    expect(wirdAngezeigt(lage(6, 4))).toBe(true);
    expect(wirdAngezeigt(lage(6, 6))).toBe(false); // voller Kurs: nicht angezeigt
    expect(wirdAngezeigt(lage(null, 0))).toBe(false);
    expect(wirdAngezeigt(lage(1, 0))).toBe(false);
  });

  it("labelt Plätze zweisprachig", () => {
    expect(plaetzeLabel(3, "de")).toBe("3 freie Plätze");
    expect(plaetzeLabel(1, "de")).toBe("1 freier Platz");
    expect(plaetzeLabel(2, "en")).toBe("2 places available");
  });
});

describe("Kurs-Termin-Format", () => {
  it("formatiert Wochentag, Zeit und Dauer", () => {
    expect(formatiereKursTermin(2, "17:30", 60, "de")).toBe("Di 17:30 · 60 Min.");
    expect(formatiereKursTermin(2, "17:30", 60, "en")).toBe("Tue 17:30 · 60 min");
    expect(formatiereKursTermin(null, "17:30", 60, "de")).toBeNull();
    expect(formatiereKursTermin(2, null, 60, "de")).toBeNull();
    expect(formatiereKursTermin(2, "17:30", null, "de")).toBe("Di 17:30");
  });
});

describe("Inhalts-Parser", () => {
  it("trennt Absätze und erkennt Titel", () => {
    const bloecke = parseInhalt("Erster Absatz.\n\n## Zweiter Punkt\n\nZweiter Absatz.");
    expect(bloecke).toEqual([
      { art: "absatz", text: "Erster Absatz." },
      { art: "titel", text: "Zweiter Punkt" },
      { art: "absatz", text: "Zweiter Absatz." },
    ]);
  });

  it("sammelt Aufzählungspunkte", () => {
    const bloecke = parseInhalt("Kursangebot:\n- Deutsch\n- Englisch\n- Italienisch");
    expect(bloecke).toEqual([
      { art: "absatz", text: "Kursangebot:" },
      { art: "liste", punkte: ["Deutsch", "Englisch", "Italienisch"] },
    ]);
  });

  it("erträgt leere Inhalte und Windows-Zeilenenden", () => {
    expect(parseInhalt("")).toEqual([]);
    expect(parseInhalt("A\r\n\r\n- B\r\n- C")).toEqual([
      { art: "absatz", text: "A" },
      { art: "liste", punkte: ["B", "C"] },
    ]);
  });
});
