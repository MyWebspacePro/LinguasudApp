// Büro-Dienstplanungslogik (Modul 8, pure): wiederkehrendes Pensum,
// Tages-Abweichungen, Abwesenheiten und Urlaubs-Kontingent. Die Konvertierung
// der DB-Daten zu Kalendertags-Keys (Europe/Zurich) läuft in den Pages/Actions;
// dieses Modul ist bewusst ohne DB-Client getestbar.

import { addDays, tageZwischen, weekdayOfDateKey } from "@/lib/zeit";

/** Default laut Pflichtenheft: 20 Urlaubs-Tage pro Person und Jahr (anpassbar). */
export const BUERO_URLAUB_DEFAULT_TAGE = 20;

/** Kurz-Bezeichnungen der Abwesenheits-Arten. */
export const BUERO_ABWESENHEIT_LABELS = {
  URLAUB: "Urlaub",
  KRANKHEIT: "Krankheit",
  SONSTIGE: "Sonstige Abwesenheit",
} as const;

/** Kurz-Bezeichnungen der Abweichungs-Arten. */
export const BUERO_ABWEICHUNG_LABELS = {
  ARBEITSZEIT: "Abweichende Arbeitszeit",
  FREI: "Dienstfrei",
} as const;

/** Pensum-Block (BueroDienst): "HH:mm" in Lokalzeit, Sortierung via startZeit. */
export interface DienstBlock {
  wochentag: number; // 1 = Montag … 7 = Sonntag
  startZeit: string;
  endZeit: string;
  notiz: string | null;
}

/** Tages-Abweichung: ARBEITSZEIT ersetzt die Pensum-Blöcke, FREI = dienstfrei. */
export interface TagesAbweichung {
  art: "ARBEITSZEIT" | "FREI";
  startZeit: string | null;
  endZeit: string | null;
  notiz: string | null;
}

/** Abwesenheit als Kalender-Datumsbereich (inklusive). */
export interface AbwesenheitBereich {
  art: "URLAUB" | "KRANKHEIT" | "SONSTIGE";
  vonKey: string;
  bisKey: string;
  bemerkung: string | null;
}

export type AbwesenheitArt = keyof typeof BUERO_ABWESENHEIT_LABELS;

/** Was an einem konkreten Tag gilt — Grundlage der Wochenansicht. */
export interface TagesPlan {
  /** Gearbeitete Blöcke des Tags (Pensum oder abweichende Arbeitszeit). */
  bloecke: { startZeit: string; endZeit: string; notiz: string | null; quelle: "PENSUM" | "ABWEICHUNG" }[];
  /** Abwesenheits-Art, die den Tag abdeckt (URLAUB zählt aufs Kontingent). */
  abwesenheit: AbwesenheitArt | null;
  /** Dienstfrei ohne Abwesenheits-Art (Abweichung FREI, z.B. Kompensation). */
  dienstfrei: boolean;
}

// ——— Kalender-Helfer ————————————————————————————————————————————————

/** Montag der Kalenderwoche, die den Tag enthält (wochenStart). */
export function wochenStart(dateKey: string): string {
  const wochentag = weekdayOfDateKey(dateKey);
  return addDays(dateKey, 1 - wochentag);
}

/** Die 7 Kalendertage der Woche ab dem Montag (Mo … So). */
export function wochenTage(montagKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(montagKey, i));
}

// ——— Tagesplan ————————————————————————————————————————————————————

/** Pensum-Blöcke eines Wochentags, chronologisch sortiert. */
export function diensteFuerWochentag<T extends DienstBlock>(dienste: readonly T[], wochentag: number): T[] {
  return dienste
    .filter((d) => d.wochentag === wochentag)
    .sort((a, b) => a.startZeit.localeCompare(b.startZeit) || a.endZeit.localeCompare(b.endZeit));
}

/**
 * Was gilt an diesem Kalendertag? Priorität: Abwesenheit (krank/Urlaub schlägt
 * alles) → Tages-Abweichung (ARBEITSZEIT ersetzt die Pensum-Blöcke, FREI =
 * ganztägig frei) → sonst das wiederkehrende Pensum des Wochentags.
 */
export function planDesTages(
  dateKey: string,
  dienste: readonly DienstBlock[],
  abweichung: TagesAbweichung | null,
  abwesenheiten: readonly AbwesenheitBereich[],
): TagesPlan {
  const abwesend = abwesenheiten.find((a) => a.vonKey <= dateKey && dateKey <= a.bisKey);
  if (abwesend) {
    return { bloecke: [], abwesenheit: abwesend.art, dienstfrei: false };
  }
  if (abweichung) {
    if (abweichung.art === "FREI") {
      return { bloecke: [], abwesenheit: null, dienstfrei: true };
    }
    return {
      bloecke: [
        {
          startZeit: abweichung.startZeit ?? "",
          endZeit: abweichung.endZeit ?? "",
          notiz: abweichung.notiz,
          quelle: "ABWEICHUNG",
        },
      ],
      abwesenheit: null,
      dienstfrei: false,
    };
  }
  return {
    bloecke: diensteFuerWochentag(dienste, weekdayOfDateKey(dateKey)).map((d) => ({
      startZeit: d.startZeit,
      endZeit: d.endZeit,
      notiz: d.notiz,
      quelle: "PENSUM",
    })),
    abwesenheit: null,
    dienstfrei: false,
  };
}

// ——— Urlaubskontingent ——————————————————————————————————————————————

const jahrStart = (jahr: number) => `${jahr}-01-01`;
const jahrEnde = (jahr: number) => `${jahr}-12-31`;

function tageImBereichInklusive(vonKey: string, bisKey: string): number {
  return tageZwischen(vonKey, bisKey) + 1;
}

/**
 * Genutzte Urlaubs-Tage im Kalenderjahr: Summe der Kalendertage aller
 * URLAUB-Abwesenheiten, am Jahresrand geklemmt (Bereiche über den
 * Jahreswechsel zählen anteilig in beide Jahre).
 */
export function urlaubstageImJahr(abwesenheiten: readonly AbwesenheitBereich[], jahr: number): number {
  const start = jahrStart(jahr);
  const ende = jahrEnde(jahr);
  return abwesenheiten
    .filter((a) => a.art === "URLAUB" && a.vonKey <= a.bisKey)
    .reduce((summe, a) => {
      const von = a.vonKey < start ? start : a.vonKey;
      const bis = a.bisKey > ende ? ende : a.bisKey;
      return summe + (von <= bis ? tageImBereichInklusive(von, bis) : 0);
    }, 0);
}

/** Kontingent-Tage für das Jahr (anpassbar); ohne Eintrag gilt der Default. */
export function kontingentFuerJahr(eintraege: readonly { jahr: number; tage: number }[], jahr: number): number {
  return eintraege.find((e) => e.jahr === jahr)?.tage ?? BUERO_URLAUB_DEFAULT_TAGE;
}

/** Restliche Urlaubs-Tage (positiv = offen, negativ = überschritten). */
export function urlaubRest(genutzt: number, kontingent: number): number {
  return kontingent - genutzt;
}

// ——— Jahresübersicht ————————————————————————————————————————————————

/** Zusammenhängender Bereich gleicher Klassifikation in der Jahresansicht. */
export interface JahresSegment {
  vonKey: string;
  bisKey: string;
  /** Abwesenheits-Art; null = keine Abwesenheit (Wochenende färbt die Spalte). */
  art: AbwesenheitArt | null;
}

/**
 * Segmente eines Jahres für die horizontal scrollende Jahresübersicht:
 * jeder Tag wird wie in planDesTages klassifiziert (erste deckende
 * Abwesenheit gewinnt, unsortierte Bereiche passen nie), zusammenhängende
 * Tage gleicher Art werden zu einem Segment zusammengefasst. Ranges über
 * den Jahresrand sind durch den Tag-für-Tag-Weg automatisch geklemmt.
 */
export function jahresSegmente(abwesenheiten: readonly AbwesenheitBereich[], jahr: number): JahresSegment[] {
  const segmente: JahresSegment[] = [];
  let offen: JahresSegment | null = null;
  for (let tag = jahrStart(jahr); tag <= jahrEnde(jahr); tag = addDays(tag, 1)) {
    const abwesend = abwesenheiten.find((a) => a.vonKey <= tag && tag <= a.bisKey);
    const art = abwesend ? abwesend.art : null;
    if (offen && offen.art === art) {
      offen.bisKey = tag;
    } else {
      if (offen) segmente.push(offen);
      offen = { vonKey: tag, bisKey: tag, art };
    }
  }
  if (offen) segmente.push(offen);
  return segmente;
}

// ——— Validierungs-Helfer (auch für die Server-Actions) ——————————————

/** "HH:mm" → Minuten seit Mitternacht (null bei ungültig). */
export function uhrzeitZuMinuten(zeit: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(zeit);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Zeitfenster prüfen: beide Zeiten gültig und Start strikt vor Ende
 * (Blöcke enden am selben Tag — über Mitternacht arbeiten ist im Büro
 * nicht vorgesehen).
 */
export function istGueltigesZeitfenster(startZeit: string, endZeit: string): boolean {
  const start = uhrzeitZuMinuten(startZeit);
  const ende = uhrzeitZuMinuten(endZeit);
  return start !== null && ende !== null && start < ende;
}
