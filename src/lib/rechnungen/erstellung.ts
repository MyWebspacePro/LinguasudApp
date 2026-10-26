import "server-only";

// Rechnungs-Erstellung (Modul 9, server): fortlaufende Rechnungsnummer
// (Zähler in SystemSetting), Empfänger-Snapshot (Person mit abweichender
// Rechnungsadresse / Kostenträger) und die automatische Paket-Rechnung
// (privat/Firma) als Anschluss an die Paketende-Automatik aus Modul 5/7.
// Öffentliche Einrichtungen rechnen im Nachhinein durchs Büro (manuell).

import { db, toDbTime } from "@/lib/db";
import { ANREDE_LABELS } from "@/lib/domain";
import { baueReferenzNr } from "./qr";
import {
  berechneSumme,
  faelligkeitsDateKey,
  formatiereRechnungsnummer,
  type RechnungStatus,
} from "./logik";
import { heuteDateKey, dateKeyOf } from "@/lib/zeit";

const ZAEHLER_KEY = "rechnung.laufnummer";

export interface PositionInput {
  text: string;
  menge: number;
  einzelpreisChf: string;
}

export interface RechnungEmpfaenger {
  personId: string | null;
  kostentraegerId: string | null;
  /** Modul 12 — Mieter der Raumvermietung (dritter Empfänger-Typ). */
  mieterId?: string | null;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email: string | null;
}

export interface ErstelleRechnungInput {
  empfaenger: RechnungEmpfaenger;
  positionen: readonly PositionInput[];
  mwstSatzProzent: number | null;
  /** Fälligkeit in Tagen ab heute (Standard 30). */
  zahlungsfristTage?: number;
  notiz?: string | null;
  anmeldungId?: string | null;
}

export interface ErstelltRechnung {
  id: string;
  nummer: string;
  referenzNr: string;
  totalChf: string;
  status: RechnungStatus;
}

/** Empfänger-Snapshot für eine Person (abweichende Rechnungsadresse beachten). */
export function empfaengerVonPerson(person: {
  id: string;
  anrede: string;
  vorname: string;
  nachname: string;
  email: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  rechnungStrasse: string | null;
  rechnungPlz: string | null;
  rechnungOrt: string | null;
}): RechnungEmpfaenger {
  // Abweichende Rechnungsadresse: komplett leer = Postadresse gilt auch für Rechnungen.
  const rechnungsadresse = person.rechnungStrasse || person.rechnungPlz || person.rechnungOrt;
  return {
    personId: person.id,
    kostentraegerId: null,
    name: `${ANREDE_LABELS[person.anrede as "HERR" | "FRAU" | "DIVERS"] ?? ""} ${person.vorname} ${person.nachname}`.trim(),
    strasse: (rechnungsadresse ? person.rechnungStrasse : person.strasse) ?? "",
    plz: (rechnungsadresse ? person.rechnungPlz : person.plz) ?? "",
    ort: (rechnungsadresse ? person.rechnungOrt : person.ort) ?? "",
    land: "CH",
    email: person.email,
  };
}

/** Empfänger-Snapshot für einen Kostenträger (Firma / öffentliche Einrichtung). */
export function empfaengerVonKostentraeger(kt: {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  email?: string | null;
}): RechnungEmpfaenger {
  return {
    personId: null,
    kostentraegerId: kt.id,
    name: kt.name,
    strasse: kt.strasse,
    plz: kt.plz,
    ort: kt.ort,
    land: "CH",
    email: kt.email ?? null,
  };
}

/** Empfänger-Snapshot für einen Mieter der Raumvermietung (Modul 12). */
export function empfaengerVonMieter(mieter: {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  email?: string | null;
}): RechnungEmpfaenger {
  return {
    personId: null,
    kostentraegerId: null,
    mieterId: mieter.id,
    name: mieter.name,
    strasse: mieter.strasse,
    plz: mieter.plz,
    ort: mieter.ort,
    land: "CH",
    email: mieter.email ?? null,
  };
}

/**
 * Legt die Rechnung an (Entwurf): Zähler, Nummer, Referenznummer, Positionen
 * und Summen in einer Transaktion. Wirft bei ungültigen Positionen.
 */
export async function erstelleRechnung(input: ErstelleRechnungInput): Promise<ErstelltRechnung> {
  if (input.positionen.length === 0) {
    throw new Error("Eine Rechnung braucht mindestens eine Position.");
  }
  for (const position of input.positionen) {
    if (!position.text.trim()) throw new Error("Jede Position braucht einen Text.");
    if (!Number.isInteger(position.menge) || position.menge < 1 || position.menge > 999) {
      throw new Error("Menge muss zwischen 1 und 999 liegen.");
    }
    const preis = Number(position.einzelpreisChf);
    if (!Number.isFinite(preis) || preis < 0 || preis > 999_999) {
      throw new Error(`Ungültiger Einzelpreis bei «${position.text}».`);
    }
  }
  const summe = berechneSumme(input.positionen, input.mwstSatzProzent);

  return db.transaction(async (tx) => {
    const zaehler = await tx.orm.public.SystemSetting.where({ key: ZAEHLER_KEY }).first();
    const laufnummer = (zaehler ? Number(zaehler.value) : 0) + 1;
    if (zaehler) {
      await tx.orm.public.SystemSetting.where({ key: ZAEHLER_KEY }).update({ value: String(laufnummer) });
    } else {
      await tx.orm.public.SystemSetting.create({ key: ZAEHLER_KEY, value: String(laufnummer) });
    }

    const heute = heuteDateKey();
    const rechnungsdatum = `${heute}T00:00:00.000Z`;
    const faelligAm = toDbTime(new Date(`${faelligkeitsDateKey(heute, input.zahlungsfristTage ?? 30)}T00:00:00.000Z`));
    const nummer = formatiereRechnungsnummer(Number(heute.slice(0, 4)), laufnummer);

    const created = await tx.orm.public.Rechnung.create({
      nummer,
      status: "ENTWURF",
      personId: input.empfaenger.personId,
      kostentraegerId: input.empfaenger.kostentraegerId,
      mieterId: input.empfaenger.mieterId ?? null,
      empfaengerName: input.empfaenger.name,
      empfaengerStrasse: input.empfaenger.strasse,
      empfaengerPlz: input.empfaenger.plz,
      empfaengerOrt: input.empfaenger.ort,
      empfaengerLand: input.empfaenger.land,
      empfaengerEmail: input.empfaenger.email,
      betragChf: summe.betragChf,
      mwstSatzProzent: input.mwstSatzProzent === null ? null : input.mwstSatzProzent.toFixed(2),
      totalChf: summe.totalChf,
      rechnungsdatum,
      faelligAm,
      mahnStufe: 0,
      referenzNr: baueReferenzNr(laufnummer),
      notiz: input.notiz ?? null,
      anmeldungId: input.anmeldungId ?? null,
    });

    for (const [index, position] of input.positionen.entries()) {
      await tx.orm.public.RechnungsPosition.create({
        rechnungId: created.id,
        text: position.text.trim(),
        menge: position.menge,
        einzelpreisChf: position.einzelpreisChf,
        reihenfolge: index,
      });
    }

    return { id: created.id, nummer, referenzNr: created.referenzNr, totalChf: summe.totalChf, status: created.status as RechnungStatus };
  });
}

/**
 * Automatische Paket-Rechnung bei fester Anmeldung / Paket-Verlängerung
 * (nur privat/Firma — öffentliche Einrichtungen rechnen im Nachhinein).
 * Gibt die erstellte Rechnung oder null zurück (kein Rechnungsweg / fehlender
 * Kostenträger).
 */
export async function erstellePaketRechnung(
  anmeldung: {
    id: string;
    status: string;
    billingTyp: string;
    kostentraegerId: string | null;
    rechnungsempfaengerId: string | null;
    personId: string;
    paketGroesse: number;
    preisChf: string;
  },
  kursCode: string,
  anlass: "ANMELDUNG" | "VERLAENGERUNG",
): Promise<ErstelltRechnung | null> {
  if (anmeldung.billingTyp === "OEFFENTLICHE_EINRICHTUNG") return null;

  let empfaenger: RechnungEmpfaenger | null = null;
  if (anmeldung.billingTyp === "FIRMA") {
    const kt = anmeldung.kostentraegerId
      ? await db.orm.public.Kostentraeger.where({ id: anmeldung.kostentraegerId }).first()
      : null;
    if (!kt) return null;
    empfaenger = empfaengerVonKostentraeger(kt);
  } else {
    const zielId = anmeldung.rechnungsempfaengerId ?? anmeldung.personId;
    const person = await db.orm.public.Person.where({ id: zielId }).first();
    if (!person) return null;
    empfaenger = empfaengerVonPerson(person);
  }

  return erstelleRechnung({
    empfaenger,
    anmeldungId: anmeldung.id,
    mwstSatzProzent: null,
    positionen: [
      {
        text: `Paket ${anmeldung.paketGroesse} Lektionen — Kurs ${kursCode}`,
        menge: 1,
        einzelpreisChf: String(anmeldung.preisChf),
      },
    ],
    notiz:
      anlass === "VERLAENGERUNG"
        ? "Automatisch ausgelöst durch die Paket-Verlängerung."
        : "Automatisch ausgelöst durch die feste Anmeldung (Paket).",
  });
}

/** Heutiger Kalendertag (UTC-Mitternacht) für Rechnungsdatum-Anzeige. */
export function rechnungsdatumDateKey(datum: string): string {
  return dateKeyOf(new Date(datum.includes("T") ? datum : `${datum.replace(" ", "T")}Z`));
}
