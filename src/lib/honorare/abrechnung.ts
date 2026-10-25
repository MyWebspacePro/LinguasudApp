import "server-only";

// Datenladen für die Honorarabrechnung (Modul 11): Default-Stundensatz aus
// SystemSetting, Honorar-Matrix und die Monatsliste der DURCHGEFÜHRTen
// Lektionen (Lokal-Tage Europe/Zurich) inkl. Abrechnungs-Status pro
// Lehrperson («als bezahlt markieren»). Nur Lektionen mit Lehrperson sind
// abrechenbar; die Liste meldet die übrigen separat.

import { db, fromDbTime, toDbTime } from "@/lib/db";
import { HONORAR_DEFAULT_KEY } from "@/lib/domain";
import { zonedTimeToUtc } from "@/lib/zeit";
import {
  gruppiereMonatsLektionen,
  naechsterMonat,
  type HonorarPerson,
  type LehrpersonMonat,
  type MatrixSatz,
} from "./logik";

/** Globaler Default-Stundensatz (SystemSetting); null = nicht gepflegt. */
export async function ladeDefaultStundensatz(): Promise<number | null> {
  const setting = await db.orm.public.SystemSetting.where({ key: HONORAR_DEFAULT_KEY }).first();
  if (!setting) return null;
  const wert = Number(setting.value.replace(",", "."));
  return Number.isFinite(wert) && wert > 0 ? wert : null;
}

/** Schreibt den globalen Default-Stundensatz (Admin-Stammdaten). */
export async function speichereDefaultStundensatz(stundensatz: number): Promise<void> {
  const wert = stundensatz.toFixed(2);
  const bestehend = await db.orm.public.SystemSetting.where({ key: HONORAR_DEFAULT_KEY }).first();
  if (bestehend) {
    await db.orm.public.SystemSetting.where({ key: HONORAR_DEFAULT_KEY }).update({ value: wert });
  } else {
    await db.orm.public.SystemSetting.create({ key: HONORAR_DEFAULT_KEY, value: wert });
  }
}

/** Zeile der Honorar-Matrix für die Pflege-UI. */
export interface MatrixSatzRoh {
  id: string;
  lehrpersonId: string;
  lehrpersonName: string;
  kuerzel: string | null;
  kursartId: string;
  kursartName: string;
  minuten: number;
  stundensatz: number;
}

/** Honorar-Matrix (Roh-Zeilen mit Namen + reine Zahlen-Struktur für die Logik). */
export async function ladeSaetze(): Promise<{ saetze: MatrixSatz[]; roh: MatrixSatzRoh[] }> {
  const rows = await db.orm.public.HonorarSatz
    .include("lehrperson")
    .include("kursart")
    .all();
  const roh: MatrixSatzRoh[] = rows
    .map((s) => ({
      id: s.id,
      lehrpersonId: s.lehrpersonId,
      lehrpersonName: `${s.lehrperson.vorname} ${s.lehrperson.nachname}`,
      kuerzel: s.lehrperson.kuerzel,
      kursartId: s.kursartId,
      kursartName: s.kursart.name,
      minuten: s.minuten,
      stundensatz: Number(s.stundensatzChf.toString()),
    }))
    .sort((a, b) => a.lehrpersonName.localeCompare(b.lehrpersonName, "de-CH") || a.minuten - b.minuten);
  return {
    saetze: roh.map(({ lehrpersonId, kursartId, minuten, stundensatz }) => ({
      lehrpersonId,
      kursartId,
      minuten,
      stundensatz,
    })),
    roh,
  };
}

/** Gespeicherter Status «als bezahlt markieren» pro Lehrperson und Monat. */
export interface AbrechnungsStatus {
  status: "OFFEN" | "BEZAHLT";
  lektionenAnzahl: number;
  totalChf: number;
  bezahltAt: Date | null;
  actorName: string;
  /** true, wenn die Lektionsliste seit dem Markieren vom Snapshot abweicht. */
  abweichendVonSnapshot: boolean;
}

export interface MonatsGruppe {
  monat: LehrpersonMonat;
  abrechnung: AbrechnungsStatus | null;
}

/**
 * Monats-Abrechnung: DURCHGEFÜHRTE Lektionen des Monats (Lokal-Tage
 * Europe/Zurich) gruppiert pro Lehrperson, plus den Abrechnungs-Status
 * (Snapshot) und eine Warnung, wenn die Liste seit dem Markieren abweicht.
 */
export async function ladeMonatsAbrechnung(monatKey: string): Promise<{
  gruppen: MonatsGruppe[];
  ohneLehrperson: number;
}> {
  const startUtc = zonedTimeToUtc(`${monatKey}-01`, "00:00");
  const endeUtc = zonedTimeToUtc(`${naechsterMonat(monatKey)}-01`, "00:00");

  const [lektionenRows, saetzeLadung, abrechnungenRows, defaultSatz, lehrpersonenRows, sprachen, niveaus] =
    await Promise.all([
      db.orm.public.Lektion
        .where((l) => l.status.in(["DURCHGEFUEHRT"]))
        .where((l) => l.startAt.gte(toDbTime(startUtc)))
        .where((l) => l.startAt.lt(toDbTime(endeUtc)))
        .include("kurs")
        .all(),
      ladeSaetze(),
      db.orm.public.HonorarAbrechnung.where({ monat: monatKey }).all(),
      ladeDefaultStundensatz(),
      db.orm.public.Person.where({ istLehrperson: true }).all(),
      db.orm.public.Sprache.all(),
      db.orm.public.Niveau.all(),
    ]);

  const spracheById = new Map(sprachen.map((s) => [s.id, s]));
  const niveauById = new Map(niveaus.map((n) => [n.id, n]));

  const personen: HonorarPerson[] = lehrpersonenRows
    .map((p) => ({ id: p.id, name: `${p.vorname} ${p.nachname}`, kuerzel: p.kuerzel }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  const ohneLehrperson = lektionenRows.filter((l) => !l.lehrpersonId).length;
  const gruppen = gruppiereMonatsLektionen(
    lektionenRows.map((l) => ({
      id: l.id,
      lehrpersonId: l.lehrpersonId,
      kursartId: l.kurs.kursartId,
      dauerMinuten: l.dauerMinuten,
      startAt: l.startAt,
      kursCode: l.kurs.code,
      kursBezeichnung:
        `${spracheById.get(l.kurs.spracheId)?.name ?? "?"} ${niveauById.get(l.kurs.niveauId)?.code ?? "?"}`.trim(),
    })),
    saetzeLadung.saetze,
    defaultSatz,
    personen,
  );

  const abrechnungByLehrperson = new Map(abrechnungenRows.map((a) => [a.lehrpersonId, a]));
  const result: MonatsGruppe[] = gruppen.map((monat) => {
    const abrechnung = abrechnungByLehrperson.get(monat.lehrpersonId);
    if (!abrechnung) return { monat, abrechnung: null };
    const abweichend =
      Math.round(Number(abrechnung.totalChf.toString()) * 100) !== Math.round(monat.totalChf * 100);
    return {
      monat,
      abrechnung: {
        status: abrechnung.status,
        lektionenAnzahl: abrechnung.lektionenAnzahl,
        totalChf: Number(abrechnung.totalChf.toString()),
        bezahltAt: abrechnung.bezahltAt ? fromDbTime(abrechnung.bezahltAt) : null,
        actorName: abrechnung.actorName,
        abweichendVonSnapshot: abweichend,
      },
    };
  });

  return { gruppen: result, ohneLehrperson };
}
