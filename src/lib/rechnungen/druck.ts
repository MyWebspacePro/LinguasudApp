import "server-only";

// Rechnungs-PDF laden (Modul 9): Daten aus der DB sammeln, QR-Payload mit
// der Schul-Konfiguration (QR-IBAN) bauen und das PDF erzeugen.

import { db } from "@/lib/db";
import { getEnv, isQrRechnungConfigured } from "@/lib/env";
import { baueQrPayload } from "./qr";
import { baueRechnungsPdf, type RechnungPdfPosition } from "./pdf";

/** QR-Payload für eine Rechnung (Fehler mit klarer Meldung bei Fehlkonfiguration). */
export function baueQrPayloadFuerRechnung(daten: {
  qrIban: string;
  empfaenger: { name: string; strasse: string; plz: string; ort: string };
  totalChf: string;
  referenzNr: string;
  nummer: string;
}): string {
  const env = getEnv();
  if (!isQrRechnungConfigured(env)) {
    throw new Error(
      "Die QR-Rechnung ist nicht konfiguriert — bitte QR_RECHNUNG_QR_IBAN, QR_RECHNUNG_NAME, QR_RECHNUNG_STRASSE, QR_RECHNUNG_PLZ und QR_RECHNUNG_ORT setzen (siehe .env.example).",
    );
  }
  return baueQrPayload({
    qrIban: env.QR_RECHNUNG_QR_IBAN!,
    empfaenger: {
      name: env.QR_RECHNUNG_NAME!,
      strasse: env.QR_RECHNUNG_STRASSE!,
      plz: env.QR_RECHNUNG_PLZ!,
      ort: env.QR_RECHNUNG_ORT!,
      land: env.QR_RECHNUNG_LAND,
    },
    betragChf: daten.totalChf,
    waehrung: "CHF",
    faelligAm: null,
    referenzNr: daten.referenzNr,
    mitteilung: `Rechnung ${daten.nummer}`,
  });
}

export interface RechnungPdfLadung {
  nummer: string;
  bytes: Uint8Array;
}

/** Lädt die Rechnung samt Positionen/Zahlungen und erzeugt das PDF. */
export async function ladeRechnungsPdf(rechnungId: string): Promise<RechnungPdfLadung> {
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) throw new Error("Rechnung nicht gefunden.");

  const positionen = await db.orm.public.RechnungsPosition
    .where({ rechnungId })
    .orderBy((p) => p.reihenfolge.asc())
    .all();
  const zahlungen = await db.orm.public.Zahlung.where({ rechnungId }).all();

  const env = getEnv();
  const qrPayload = baueQrPayloadFuerRechnung({
    qrIban: env.QR_RECHNUNG_QR_IBAN ?? "",
    empfaenger: { name: env.QR_RECHNUNG_NAME ?? "", strasse: env.QR_RECHNUNG_STRASSE ?? "", plz: env.QR_RECHNUNG_PLZ ?? "", ort: env.QR_RECHNUNG_ORT ?? "" },
    totalChf: String(rechnung.totalChf),
    referenzNr: rechnung.referenzNr,
    nummer: rechnung.nummer,
  });

  const pdfPositionen: RechnungPdfPosition[] = positionen.map((p) => ({
    text: p.text,
    menge: p.menge,
    einzelpreisChf: String(p.einzelpreisChf),
  }));

  const bezahlt = zahlungen.reduce((summe, z) => summe + Number(z.betragChf), 0);

  const daten = {
    nummer: rechnung.nummer,
    status: rechnung.status as Parameters<typeof baueRechnungsPdf>[0]["status"],
    rechnungsdatum: datumKeyVonDb(rechnung.rechnungsdatum),
    faelligAm: datumKeyVonDb(rechnung.faelligAm),
    empfaenger: {
      name: rechnung.empfaengerName,
      strasse: rechnung.empfaengerStrasse,
      plz: rechnung.empfaengerPlz,
      ort: rechnung.empfaengerOrt,
      land: rechnung.empfaengerLand,
    },
    schule: {
      name: env.QR_RECHNUNG_NAME || "Sprachschule linguasud",
      strasse: env.QR_RECHNUNG_STRASSE || "",
      plz: env.QR_RECHNUNG_PLZ || "",
      ort: env.QR_RECHNUNG_ORT || "",
      qrIban: env.QR_RECHNUNG_QR_IBAN || "",
    },
    positionen: pdfPositionen,
    mwstSatzProzent: rechnung.mwstSatzProzent === null ? null : Number(rechnung.mwstSatzProzent),
    betragChf: String(rechnung.betragChf),
    mwstChf: (Number(rechnung.totalChf) - Number(rechnung.betragChf)).toFixed(2),
    totalChf: String(rechnung.totalChf),
    bezahltChf: bezahlt.toFixed(2),
    notiz: rechnung.notiz,
    referenzNr: rechnung.referenzNr,
    qrPayload,
  };

  const bytes = await baueRechnungsPdf(daten);
  return { nummer: rechnung.nummer, bytes };
}

/** DB-DateTime (UTC) → Kalendertag "YYYY-MM-DD" (UTC-Mitternacht-Muster). */
function datumKeyVonDb(datum: string): string {
  return datum.slice(0, 10);
}
