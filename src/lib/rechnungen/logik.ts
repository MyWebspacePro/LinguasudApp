// Rechnungslogik (Modul 9, pure): Status-Laufbahn, Betragsrechnung
// (Positionen × Menge, MwSt, Restbetrag), Fälligkeit/Überfälligkeit und
// die Mahn-Stufen-Automatik. Alle Beträge als Strings mit 2 Dezimalen
// (Muster Decimal-Felder der Anmeldung).

export type RechnungStatus =
  | "ENTWURF"
  | "VERSENDET"
  | "TEILBEZAHLT"
  | "BEZAHLT"
  | "STORNIERT";

/** Status-Bezeichnungen (Modul 9); «überfällig» ist abgeleitet, kein Status. */
export const RECHNUNG_STATUS_LABELS: Record<RechnungStatus, string> = {
  ENTWURF: "Entwurf",
  VERSENDET: "versendet",
  TEILBEZAHLT: "teilbezahlt",
  BEZAHLT: "bezahlt",
  STORNIERT: "storniert",
};

/** Reihenfolge des Lebenszyklus (für Badges/Filter). */
export const RECHNUNG_STATUS_WERTE: readonly RechnungStatus[] = [
  "ENTWURF",
  "VERSENDET",
  "TEILBEZAHLT",
  "BEZAHLT",
  "STORNIERT",
];

/** Zahlungsfrist der Automatik-Rechnungen (Paket-Verlängerung): 30 Tage. */
export const ZAHLUNGSFRIST_TAGE = 30;

/** Mahn-Stufe 1 (freundliche Erinnerung) so viele Tage nach Fälligkeit. */
export const MAHN_STUFE_1_TAGE = 10;

/** Mahn-Stufe 2 (Mahnung) so viele Tage nach Fälligkeit. */
export const MAHN_STUFE_2_TAGE = 30;

/** Betrag auf 2 Dezimalen (String, kein Tausendertrennzeichen) — DB-Schreibformat. */
export function betragString(betrag: number): string {
  if (!Number.isFinite(betrag) || betrag < 0 || betrag > 9_999_999.99) {
    throw new Error(`Ungültiger Betrag: ${betrag}`);
  }
  return betrag.toFixed(2);
}

/** Betrag-String → Number (Anzeige); leere/ungültige Werte = 0. */
export function betragZahl(betrag: string | number | null | undefined): number {
  if (betrag === null || betrag === undefined || betrag === "") return 0;
  const n = Number(String(betrag).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export interface PositionEingabe {
  text: string;
  menge: number;
  einzelpreisChf: string;
}

export interface RechnungsSumme {
  /** Positionen exklusive MwSt. */
  betragChf: string;
  /** MwSt-Betrag (0, wenn kein Satz erfasst). */
  mwstChf: string;
  /** Total inklusive MwSt. */
  totalChf: string;
}

/**
 * Summe über die Positionen: Menge × Einzelpreis, gerundet pro Position
 * (Schweizer Praxis: Positionszeilen gerundet, Summe exakt), MwSt auf dem
 * Zwischenbetrag (Bankers-Rounding → halbe auf 5 Rappen via toFixed).
 */
export function berechneSumme(
  positionen: readonly PositionEingabe[],
  mwstSatzProzent: number | null,
): RechnungsSumme {
  const betrag = positionen.reduce(
    (summe, p) => summe + Math.round(betragZahl(p.einzelpreisChf) * p.menge * 100) / 100,
    0,
  );
  const betragChf = betragString(betrag);
  if (mwstSatzProzent === null || mwstSatzProzent === 0) {
    return { betragChf, mwstChf: "0.00", totalChf: betragChf };
  }
  const mwst = Math.round(betrag * mwstSatzProzent) / 100;
  const mwstChf = betragString(mwst);
  return { betragChf, mwstChf, totalChf: betragString(betrag + mwst) };
}

/** Restbetrag = Total − Summe Zahlungen (nie negativ). */
export function restbetrag(totalChf: string, zahlungen: readonly string[]): string {
  const bezahlt = zahlungen.reduce((summe, z) => summe + betragZahl(z), 0);
  const rest = Math.round((betragZahl(totalChf) - bezahlt) * 100) / 100;
  return betragString(Math.max(0, rest));
}

/** Rechnungsnummer "RE-2026-0001" aus Jahr und laufender Nummer. */
export function formatiereRechnungsnummer(jahr: number, laufnummer: number): string {
  return `RE-${jahr}-${String(laufnummer).padStart(4, "0")}`;
}

/** Rechnungsdatum + Zahlungsfrist: Fälligkeit als Kalendertag (Date-Key). */
export function faelligkeitsDateKey(rechnungsdatumKey: string, tage: number = ZAHLUNGSFRIST_TAGE): string {
  const d = new Date(`${rechnungsdatumKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Ist die Rechnung überfällig? (versendet/teilbezahlt und Fälligkeit verstrichen) */
export function istUeberfaellig(
  status: RechnungStatus,
  faelligAmDateKey: string,
  heuteKey: string,
): boolean {
  return (
    (status === "VERSENDET" || status === "TEILBEZAHLT") && heuteKey > faelligAmDateKey
  );
}

/**
 * Nächste zu versendende Mahn-Stufe oder null:
 * Stufe 1 = 10 Tage nach Fälligkeit (freundliche Erinnerung),
 * Stufe 2 = 30 Tage nach Fälligkeit (Mahnung). Jede Stufe genau einmal.
 */
export function naechsteMahnStufe(
  status: RechnungStatus,
  mahnStufe: number,
  faelligAmDateKey: string,
  heuteKey: string,
): 1 | 2 | null {
  if (status !== "VERSENDET" && status !== "TEILBEZAHLT") return null;
  if (!istUeberfaellig(status, faelligAmDateKey, heuteKey)) return null;
  const verstrichen = tageDifferenz(faelligAmDateKey, heuteKey);
  if (mahnStufe < 1 && verstrichen >= MAHN_STUFE_1_TAGE) return 1;
  if (mahnStufe < 2 && verstrichen >= MAHN_STUFE_2_TAGE) return 2;
  return null;
}

/** Tage-Differenz (b − a) auf Date-Keys. */
function tageDifferenz(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** Mahn-Stufe als Anzeige-Text. */
export function mahnStufeLabel(stufe: number): string {
  if (stufe >= 2) return "Mahnung (Stufe 2)";
  if (stufe === 1) return "Erinnerung (Stufe 1)";
  return "—";
}
