// Honorarabrechnung (Modul 11) — reine Logik ohne DB-Zugriff: Stundensatz-
// Hochrechnung (5-Rappen-Rundung), Satz-Auflösung über die Honorar-Matrix
// (Lehrperson × Kursart × Lektionsdauer) mit globalem Default-Stundensatz
// und die Gruppierung der durchgeführten Lektionen pro Lehrperson und Monat.

import { fromDbTime } from "@/lib/domain";
import { dateKeyOf } from "@/lib/zeit";

/**
 * Rundet auf 5 Rappen (kaufmännisch, halbe Runde weg von null) — üblich
 * für Schweizer Abrechnungen.
 */
export function rundeFuenfRappen(betrag: number): number {
  return Math.round(betrag * 20) / 20;
}

/**
 * Honorar einer Lektion: Stundensatz × Dauer/60, auf 5 Rappen gerundet.
 * Der globale Default- und die Abweichungen sind Stundensätze; die Dauer
 * wird hochgerechnet (Pflichtenheft: «genügt ein Wert, Dauer wird
 * hochgerechnet»).
 */
export function honorarFuerLektion(stundensatz: number, dauerMinuten: number): number {
  return rundeFuenfRappen((stundensatz * dauerMinuten) / 60);
}

/** CHF-Betrag mit zwei Nachkommastellen und Schweizer Tausendertrennzeichen. */
export function formatChf(betrag: number): string {
  const gerundet = Math.round(betrag * 100) / 100;
  const [ganze, rappen] = gerundet.toFixed(2).split(".");
  const mitTrennzeichen = ganze.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return `${mitTrennzeichen}.${rappen}`;
}

// ——— Honorar-Matrix ——————————————————————————————————————————————————

export interface MatrixSatz {
  lehrpersonId: string;
  kursartId: string;
  minuten: number;
  stundensatz: number;
}

/** Angewandter Satz: individuelle Abweichung oder globaler Default. */
export type SatzQuelle = "ABWEICHUNG" | "DEFAULT";

export interface AngewandterSatz {
  stundensatz: number;
  quelle: SatzQuelle;
}

/** Lektion-Rohdaten, wie sie die Abrechnung braucht. */
export interface HonorarLektion {
  id: string;
  lehrpersonId: string | null;
  kursartId: string;
  dauerMinuten: number;
  /** UTC-String aus der DB («YYYY-MM-DD HH:mm:ss»), Konvertierung via fromDbTime. */
  startAt: string;
}

/**
 * Löst den Satz einer Lektion auf: zuerst die Abweichung der Lehrperson
 * (Kursart × exakte Dauer), sonst der globale Default-Stundensatz.
 * null = weder Abweichung noch Default gepflegt (Zeile wird als Warnung
 * angezeigt, nicht fälschlich als 0 abgerechnet).
 */
export function satzFuerLektion(
  lektion: Pick<HonorarLektion, "lehrpersonId" | "kursartId" | "dauerMinuten">,
  saetze: readonly MatrixSatz[],
  defaultStundensatz: number | null,
): AngewandterSatz | null {
  const abweichung = saetze.find(
    (s) =>
      s.lehrpersonId === lektion.lehrpersonId &&
      s.kursartId === lektion.kursartId &&
      s.minuten === lektion.dauerMinuten,
  );
  if (abweichung) return { stundensatz: abweichung.stundensatz, quelle: "ABWEICHUNG" };
  if (defaultStundensatz !== null) {
    return { stundensatz: defaultStundensatz, quelle: "DEFAULT" };
  }
  return null;
}

// ——— Monats-Gruppierung ——————————————————————————————————————————————

export interface MonatsZeile {
  lektionId: string;
  /** Lokaler Kalendertag der Lektion ("YYYY-MM-DD"). */
  datumKey: string;
  kursCode: string;
  kursBezeichnung: string;
  dauerMinuten: number;
  stundensatz: number | null;
  satzQuelle: SatzQuelle | null;
  betragChf: number | null;
}

export interface LehrpersonMonat {
  lehrpersonId: string;
  lehrpersonName: string;
  kuerzel: string | null;
  zeilen: MonatsZeile[];
  totalChf: number;
  /** Lektionen ohne anwendbaren Satz (weder Abweichung noch Default gepflegt). */
  ohneSatz: number;
}

export interface HonorarPerson {
  id: string;
  name: string;
  kuerzel: string | null;
}

/**
 * Gruppiert die (durchgeführten) Lektionen eines Monats pro Lehrperson —
 * Sortierung: Name, dann Datum. Lektionen ohne lehrpersonId erscheinen
 * nicht (die Seite meldet sie separat als «nicht abrechenbar»).
 */
export function gruppiereMonatsLektionen(
  lektionen: readonly (HonorarLektion & {
    kursCode: string;
    kursBezeichnung: string;
  })[],
  saetze: readonly MatrixSatz[],
  defaultStundensatz: number | null,
  personen: readonly HonorarPerson[],
): LehrpersonMonat[] {
  const personenNachId = new Map(personen.map((p) => [p.id, p]));
  const gruppen = new Map<string, LehrpersonMonat>();

  for (const lektion of lektionen) {
    if (!lektion.lehrpersonId) continue;
    const person = personenNachId.get(lektion.lehrpersonId);
    if (!person) continue; // gelöschte Lehrperson (SetNull) — nicht abrechenbar

    const datumKey = dateKeyOf(fromDbTime(lektion.startAt));
    const satz = satzFuerLektion(lektion, saetze, defaultStundensatz);
    const zeile: MonatsZeile = {
      lektionId: lektion.id,
      datumKey,
      kursCode: lektion.kursCode,
      kursBezeichnung: lektion.kursBezeichnung,
      dauerMinuten: lektion.dauerMinuten,
      stundensatz: satz?.stundensatz ?? null,
      satzQuelle: satz?.quelle ?? null,
      betragChf: satz ? honorarFuerLektion(satz.stundensatz, lektion.dauerMinuten) : null,
    };

    let gruppe = gruppen.get(lektion.lehrpersonId);
    if (!gruppe) {
      gruppe = {
        lehrpersonId: lektion.lehrpersonId,
        lehrpersonName: person.name,
        kuerzel: person.kuerzel,
        zeilen: [],
        totalChf: 0,
        ohneSatz: 0,
      };
      gruppen.set(lektion.lehrpersonId, gruppe);
    }
    gruppe.zeilen.push(zeile);
    if (zeile.betragChf !== null) gruppe.totalChf = rundeFuenfRappen(gruppe.totalChf + zeile.betragChf);
    else gruppe.ohneSatz += 1;
  }

  for (const gruppe of gruppen.values()) {
    gruppe.zeilen.sort((a, b) => a.datumKey.localeCompare(b.datumKey) || a.lektionId.localeCompare(b.lektionId));
  }
  return [...gruppen.values()].sort((a, b) =>
    a.lehrpersonName.localeCompare(b.lehrpersonName, "de-CH"),
  );
}

// ——— Monate ——————————————————————————————————————————————————————————

const MONAT_NAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Gültiger Monatsschlüssel "YYYY-MM"? */
export function istMonatKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/** "2026-08" → "August 2026". */
export function monatLabel(key: string): string {
  const jahr = Number(key.slice(0, 4));
  const monat = Number(key.slice(5, 7));
  return `${MONAT_NAMEN[monat - 1]} ${jahr}`;
}

export function vorigerMonat(key: string): string {
  const jahr = Number(key.slice(0, 4));
  const monat = Number(key.slice(5, 7));
  return monat === 1 ? `${jahr - 1}-12` : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
}

export function naechsterMonat(key: string): string {
  const jahr = Number(key.slice(0, 4));
  const monat = Number(key.slice(5, 7));
  return monat === 12 ? `${jahr + 1}-01` : `${jahr}-${String(monat + 1).padStart(2, "0")}`;
}
