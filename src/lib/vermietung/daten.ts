import "server-only";

// Datenladen für die Raumvermietung (Modul 12): Formular-Optionen (aktive
// Mieter, Räume mit Standort·Etage·Raum-Label) und die Monats-Auswertung
// der Vermietungs-Rechnungen fürs Finanz-Dashboard des Chefs.

import { db, toDbTime } from "@/lib/db";
import { zonedTimeToUtc } from "@/lib/zeit";
import { naechsterMonat } from "@/lib/honorare/logik";

export interface RaumOption {
  id: string;
  label: string;
}

/** Räume als Auswahl («Vorstadt 18 · 1. Stock · Oxford») — Muster Planer. */
export async function ladeRaumOptionen(): Promise<RaumOption[]> {
  const [standorte, etagen, raeume] = await Promise.all([
    db.orm.public.Standort.where({ active: true }).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Etage.all(),
    db.orm.public.Raum.where({ active: true }).all(),
  ]);
  return raeume
    .map((r) => {
      const etage = etagen.find((e) => e.id === r.etageId);
      const standort = standorte.find((s) => s.id === etage?.standortId);
      return { id: r.id, label: `${standort?.name ?? "?"} · ${etage?.name ?? "?"} · ${r.name}` };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));
}

export interface MieterOption {
  id: string;
  label: string;
}

/** Aktive Mieter der Kartei (archivierte werden nicht neu vergeben). */
export async function ladeMieterOptionen(): Promise<MieterOption[]> {
  const mieter = await db.orm.public.VermietungMieter
    .where({ active: true })
    .orderBy((m) => m.name.asc())
    .all();
  return mieter.map((m) => ({ id: m.id, label: m.name }));
}

export interface VermietungsMonatAuswertung {
  /** Summe der Totals der Vermietungs-Rechnungen des Monats (ohne Storno). */
  umsatzChf: number;
  bezahltChf: number;
  offenChf: number;
  /** Nicht abgesagte Termine des Monats. */
  termine: number;
  /** Termine ohne Rechnungs-Entwurf (noch abzurechnen). */
  ohneRechnung: number;
}

/**
 * Vermietungs-Umsatz pro Monat (Lokal-Monat Europe/Zurich des Termins):
 * offen/versendet/bezahlt aus den verknüpften Vermietungs-Rechnungen —
 * Muster der Honorar-Karte im Finanz-Dashboard.
 */
export async function ladeVermietungsMonat(monatKey: string): Promise<VermietungsMonatAuswertung> {
  const startUtc = zonedTimeToUtc(`${monatKey}-01`, "00:00");
  const endeUtc = zonedTimeToUtc(`${naechsterMonat(monatKey)}-01`, "00:00");

  const termine = await db.orm.public.Vermietung
    .where((v) => v.startAt.gte(toDbTime(startUtc)))
    .where((v) => v.startAt.lt(toDbTime(endeUtc)))
    .all();
  const relevante = termine.filter((v) => v.status !== "ABGESAGT");
  const rechnungIds = relevante.map((v) => v.rechnungId).filter((id): id is string => id !== null);
  const rechnungen = rechnungIds.length
    ? await db.orm.public.Rechnung.where((r) => r.id.in(rechnungIds)).all()
    : [];
  const rechnungById = new Map(rechnungen.map((r) => [r.id, r]));

  let umsatzChf = 0;
  let bezahltChf = 0;
  let offenChf = 0;
  let ohneRechnung = 0;
  for (const v of relevante) {
    const rechnung = v.rechnungId ? rechnungById.get(v.rechnungId) : null;
    if (!rechnung) {
      ohneRechnung += 1;
      continue;
    }
    if (rechnung.status === "STORNIERT") continue;
    const total = Number(rechnung.totalChf.toString());
    umsatzChf += total;
    if (rechnung.status === "BEZAHLT") bezahltChf += total;
    else offenChf += total;
  }
  const runde = (n: number) => Math.round(n * 100) / 100;
  return {
    umsatzChf: runde(umsatzChf),
    bezahltChf: runde(bezahltChf),
    offenChf: runde(offenChf),
    termine: relevante.length,
    ohneRechnung,
  };
}
