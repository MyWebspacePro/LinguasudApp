"use client";

import { useActionState, useState } from "react";
import { saveAnmeldungAction } from "@/lib/anmeldungen/actions";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { BILLING_TYP_LABELS, BILLING_TYP_WERTE } from "@/lib/domain";
import type { BillingTyp } from "@/lib/db";

export interface AnmeldungOptionen {
  kurse: { id: string; code: string; beschreibung: string; startZeit: string | null }[];
  personen: { id: string; label: string }[];
  tarifstufen: { id: string; name: string; lessonsPerPackage: number; hinweis: string }[];
  kostentraeger: { id: string; label: string }[];
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

/**
 * Anmeldung erfassen (Modul 5): Billing-Typ, Tarif automatisch nach
 * Tageszeit (leer lassen = Automatik), Paketgrösse 14/15 (leer = Tarif-Standard),
 * Preis aus der Preisliste (leer = Listenpreis; Abweichung muss dokumentiert
 * werden). Status «Probe» wandelt sich bei fester Anmeldung um.
 */
export function AnmeldungForm({
  optionen,
  vorwahlKursId,
}: {
  optionen: AnmeldungOptionen;
  vorwahlKursId?: string;
}) {
  const [state, formAction] = useActionState(saveAnmeldungAction, idleFormState);
  const [billingTyp, setBillingTyp] = useState<BillingTyp>("PRIVAT");
  const [tarifstufeId, setTarifstufeId] = useState("");
  const gewaehlteStufe = optionen.tarifstufen.find((t) => t.id === tarifstufeId);

  const brauchtKostentraeger = billingTyp !== "PRIVAT";

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert state={state} />

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kurs & Person</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kursId" className="label">
              Kurs
            </label>
            <select id="kursId" name="kursId" defaultValue={vorwahlKursId ?? ""} required className="input">
              <option value="" disabled>
                Bitte wählen
              </option>
              {optionen.kurse.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.code} — {k.beschreibung}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.kursId} />
          </div>
          <div>
            <label htmlFor="personId" className="label">
              Teilnehmende/r
            </label>
            <select id="personId" name="personId" required className="input">
              <option value="" disabled>
                Bitte wählen
              </option>
              {optionen.personen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Interessent/innen bleiben in der Kartei und werden hier angemeldet.
            </p>
            <FieldError message={state.fieldErrors?.personId} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <select id="status" name="status" defaultValue="PROBE" className="input">
              <option value="PROBE">Probe (kein Guthaben, kein Preis)</option>
              <option value="AKTIV">fest (Paket wird aufgeladen)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Probelektionen erscheinen in der Anwesenheitsliste und wandeln sich bei fester Anmeldung um.
            </p>
            <FieldError message={state.fieldErrors?.status} />
          </div>
          <div>
            <label htmlFor="billingTyp" className="label">
              Billing-Typ
            </label>
            <select
              id="billingTyp"
              name="billingTyp"
              defaultValue="PRIVAT"
              onChange={(e) => setBillingTyp(e.target.value as BillingTyp)}
              className="input"
            >
              {BILLING_TYP_WERTE.map((b) => (
                <option key={b} value={b}>
                  {BILLING_TYP_LABELS[b]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {billingTyp === "PRIVAT"
                ? "Selbstzahlend — Rechnung im Voraus pro Paket."
                : billingTyp === "FIRMA"
                  ? "Rechnung an die Firma, im Voraus pro Paket."
                  : "Rechnung erst im Nachhinein (per geleisteten Lektionen)."}
            </p>
            <FieldError message={state.fieldErrors?.billingTyp} />
          </div>
        </div>
        {brauchtKostentraeger && (
          <div>
            <label htmlFor="kostentraegerId" className="label">
              Kostenträger (Firma / öffentliche Einrichtung)
            </label>
            <select id="kostentraegerId" name="kostentraegerId" className="input" defaultValue="">
              <option value="" disabled>
                Bitte wählen
              </option>
              {optionen.kostentraeger.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.kostentraegerId} />
          </div>
        )}
        <div>
          <label htmlFor="rechnungsempfaengerId" className="label">
            Abweichender Rechnungsempfänger (optional)
          </label>
          <select id="rechnungsempfaengerId" name="rechnungsempfaengerId" defaultValue="" className="input">
            <option value="">— Anmeldung selbst (bei Kindern z.B. Eltern) —</option>
            {optionen.personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.rechnungsempfaengerId} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Tarif, Paket, Preis (leer = Automatik)
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tarifstufeId" className="label">
              Tarifstufe
            </label>
            <select
              id="tarifstufeId"
              name="tarifstufeId"
              defaultValue=""
              onChange={(e) => setTarifstufeId(e.target.value)}
              className="input"
            >
              <option value="">automatisch nach Tageszeit</option>
              {optionen.tarifstufen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.lessonsPerPackage}/Paket)
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {gewaehlteStufe?.hinweis ?? "Vorschlag aus dem Wochentermin des Kurses."}
            </p>
            <FieldError message={state.fieldErrors?.tarifstufeId} />
          </div>
          <div>
            <label htmlFor="paketGroesse" className="label">
              Paketlektionen
            </label>
            <input
              id="paketGroesse"
              name="paketGroesse"
              type="number"
              min={1}
              max={60}
              className="input"
              placeholder={gewaehlteStufe ? `Standard ${gewaehlteStufe.lessonsPerPackage}` : "Standard 14/15"}
            />
            <FieldError message={state.fieldErrors?.paketGroesse} />
          </div>
          <div>
            <label htmlFor="preisChf" className="label">
              Preis CHF
            </label>
            <input
              id="preisChf"
              name="preisChf"
              className="input"
              placeholder="aus Preisliste"
              inputMode="decimal"
            />
            <FieldError message={state.fieldErrors?.preisChf} />
          </div>
        </div>
        <div>
          <label htmlFor="preisAbweichungGrund" className="label">
            Grund bei Preisabweichung
          </label>
          <input
            id="preisAbweichungGrund"
            name="preisAbweichungGrund"
            className="input"
            placeholder="nur nötig, wenn der Preis vom Listenpreis abweicht (z.B. Sonderdeal Firma X)"
          />
          <FieldError message={state.fieldErrors?.preisAbweichungGrund} />
        </div>
        <div>
          <label htmlFor="notizen" className="label">
            Notizen (optional)
          </label>
          <textarea id="notizen" name="notizen" rows={2} className="input" />
        </div>
      </fieldset>

      <SubmitButton>Anmeldung erfassen</SubmitButton>
    </form>
  );
}
