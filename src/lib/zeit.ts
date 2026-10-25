// Zeit-Helfer für die Schul-Domäne (pure, auch im Client nutzbar).
// Termine werden als UTC-Instants gespeichert (Prisma 8 DateTime als
// UTC-String), die Schule liegt in Europe/Zurich — Wochentag, Startzeit und
// Kalendertage sind Lokalzeit. Die Konvertierung läuft ausschliesslich über
// dieses Modul (DST-sicher, getestet am Sommer-/Winterzeit-Wechsel).

import { timeToMinutes } from "@/lib/stammdaten/tarif";

export const SCHUL_ZEITZONE = "Europe/Zurich";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  /** Kalendertag in der Zeitzone, "YYYY-MM-DD". */
  dateKey: string;
  /** Minuten seit Mitternacht (Lokalzeit). */
  minuteOfDay: number;
}

/** UTC-Instant → lokale Kalenderzeit in der Schul-Zeitzone (oder gegebenen tz). */
export function utcToZoned(date: Date, tz: string = SCHUL_ZEITZONE): ZonedParts {
  const parts = zonedFormatter(tz).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    dateKey: `${value("year")}-${String(value("month")).padStart(2, "0")}-${String(value("day")).padStart(2, "0")}`,
    minuteOfDay: value("hour") * 60 + value("minute"),
  };
}

/** Lokaler Kalendertag eines UTC-Instants ("YYYY-MM-DD"). */
export function dateKeyOf(date: Date, tz: string = SCHUL_ZEITZONE): string {
  return utcToZoned(date, tz).dateKey;
}

/** Heutiger Kalendertag in der Schul-Zeitzone. */
export function heuteDateKey(now: Date = new Date(), tz: string = SCHUL_ZEITZONE): string {
  return dateKeyOf(now, tz);
}

/** Offset der Zeitzone zum gegebenen Instant in Millisekunden (Lokalzeit − UTC). */
function zonedOffsetMs(tz: string, date: Date): number {
  const local = utcToZoned(date, tz);
  const { jahr, monat, tag } = parseDateKeyStrict(local.dateKey);
  const asUtc = Date.UTC(jahr, monat - 1, tag, Math.floor(local.minuteOfDay / 60), local.minuteOfDay % 60);
  return asUtc - date.getTime();
}

/**
 * Lokale Wanduhrzeit ("YYYY-MM-DD" + "HH:mm") → UTC-Instant.
 * Doppelter Offset-Lookup fängt die Grenzfälle am DST-Wechsel ab.
 */
export function zonedTimeToUtc(dateKey: string, time: string, tz: string = SCHUL_ZEITZONE): Date {
  const { jahr, monat, tag } = parseDateKeyStrict(dateKey);
  const min = timeToMinutes(time);
  if (min === null) throw new Error(`Ungültige Uhrzeit: ${time}`);
  const guess = Date.UTC(jahr, monat - 1, tag, Math.floor(min / 60), min % 60);
  // Beide Korrekturen vom selben guess: utc1/offset2 prüfen nur, ob der
  // erste Schritt über eine DST-Grenze gesprungen ist.
  const utc1 = guess - zonedOffsetMs(tz, new Date(guess));
  const offset2 = zonedOffsetMs(tz, new Date(utc1));
  return new Date(guess - offset2);
}

// ——— Kalender-Mathematik auf Date-Keys (rein, ohne Zeitzonen-Suche) ———

export interface DatumTeile {
  jahr: number;
  /** 1-basiert (Januar = 1). */
  monat: number;
  tag: number;
}

export function parseDateKeyStrict(key: string): DatumTeile {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Ungültiger Datumsschlüssel: ${key}`);
  return { jahr: Number(match[1]), monat: Number(match[2]), tag: Number(match[3]) };
}

export function parseDateKey(key: string): DatumTeile | null {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(key) ? parseDateKeyStrict(key) : null;
}

/** Date-Key → UTC-Mitternacht (nur für Kalenderrechnung, nicht für Termine). */
export function dateKeyToUtcMidnight(key: string): Date {
  const { jahr, monat, tag } = parseDateKeyStrict(key);
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

export function addDays(dateKey: string, n: number): string {
  const d = dateKeyToUtcMidnight(dateKey);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Differenz in Tagen (b − a). */
export function tageZwischen(a: string, b: string): number {
  return Math.round((dateKeyToUtcMidnight(b).getTime() - dateKeyToUtcMidnight(a).getTime()) / 86_400_000);
}

/** Wochentag eines Date-Keys: 1 = Montag … 7 = Sonntag (ISO-8601). */
export function weekdayOfDateKey(dateKey: string): number {
  const day = dateKeyToUtcMidnight(dateKey).getUTCDay(); // 0 = So
  return day === 0 ? 7 : day;
}

export const WOCHENTAG_NAMEN = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WOCHENTAG_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONAT_NAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "2026-10-26" → "26.10.2026". */
export function formatDatum(dateKey: string): string {
  const { jahr, monat, tag } = parseDateKeyStrict(dateKey);
  return `${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.${jahr}`;
}

/** "2026-10-26" → "Mo, 26.10." (für kompakte Planer-Streifen). */
export function formatDatumKurz(dateKey: string): string {
  const { monat, tag } = parseDateKeyStrict(dateKey);
  return `${WOCHENTAG_KURZ[weekdayOfDateKey(dateKey) - 1]}, ${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.`;
}

/** "2026-10-26" → "26. Oktober 2026". */
export function formatDatumLang(dateKey: string): string {
  const { jahr, monat, tag } = parseDateKeyStrict(dateKey);
  return `${tag}. ${MONAT_NAMEN[monat - 1]} ${jahr}`;
}

// ——— Uhrzeit ————————————————————————————————————————————————————————

/** Minuten seit Mitternacht → "HH:mm". */
export function timeFromMinutes(minuten: number): string {
  const m = ((minuten % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:mm" → Minuten seit Mitternacht (null bei ungültig/leer). */
export function minuteOfDay(time: string): number | null {
  return timeToMinutes(time);
}
