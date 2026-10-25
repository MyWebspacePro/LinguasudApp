"use client";

import { useActionState, useState } from "react";
import { saveKursAction } from "@/lib/kurse/actions";
import type { KursOptionen } from "@/lib/kurse/optionen";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";

/** Serialisierter Kurs für das Formular (Server → Client). */
export interface KursFormData {
  id: string;
  code: string;
  niveauId: string;
  niveauCode: string;
  spracheId: string;
  kursartId: string;
  lehrpersonId: string | null;
  wochentag: number | null;
  startZeit: string | null;
  dauerMinuten: number | null;
  extern: boolean;
  externOrt: string | null;
  standardRaumId: string | null;
  maxParticipants: number | null;
  kostentraegerId: string | null;
  notizen: string | null;
}

const WOCHENTAGE = [
  { value: "1", label: "Montag" },
  { value: "2", label: "Dienstag" },
  { value: "3", label: "Mittwoch" },
  { value: "4", label: "Donnerstag" },
  { value: "5", label: "Freitag" },
  { value: "6", label: "Samstag" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

/**
 * Kurs-Formular (Modul 4): Sprache × Niveau × Kursart, Lehrperson,
 * optionaler wöchentlicher Fixtermin (Basis der Lektionsgenerierung),
 * Kursort intern (Standort → Raum) oder extern («Kursort extern» —
 * Firmenkurs vor Ort, erscheint nicht im Raumplaner).
 */
export function KursForm({
  kurs,
  optionen,
}: {
  kurs?: KursFormData | null;
  optionen: KursOptionen;
}) {
  const isEdit = Boolean(kurs?.id);
  const [state, formAction] = useActionState(saveKursAction, idleFormState);
  const [hatTermin, setHatTermin] = useState(kurs?.wochentag != null);
  const [kursort, setKursort] = useState<"intern" | "extern">(kurs?.extern ? "extern" : "intern");

  const ersteStandortId =
    kurs?.standardRaumId
      ? optionen.raeume.find((r) => r.id === kurs.standardRaumId)?.standortId ?? optionen.standorte[0]?.id ?? ""
      : optionen.standorte[0]?.id ?? "";
  const [standortId, setStandortId] = useState(ersteStandortId);
  const raeumeImStandort = optionen.raeume.filter((r) => r.standortId === standortId);

  const gewaehlteKursart = optionen.kursarten.find((k) => k.id === kurs?.kursartId);

  return (
    <form action={formAction} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={kurs!.id} />}
      <FormAlert state={state} />

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kurs</legend>
        {isEdit ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="label">Kurscode</span>
              <p className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-mono text-sm">{kurs!.code}</p>
              <p className="mt-1 text-xs text-slate-500">
                Ändert sich automatisch beim Niveau-Wechsel (unten).
              </p>
            </div>
            <div>
              <span className="label">Aktuelles Niveau</span>
              <p className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">{kurs!.niveauCode}</p>
              <p className="mt-1 text-xs text-slate-500">Änderung nur über den Niveau-Verlauf.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="spracheId" className="label">
                Sprache
              </label>
              <select id="spracheId" name="spracheId" defaultValue={kurs?.spracheId ?? ""} required className="input">
                <option value="" disabled>
                  Bitte wählen
                </option>
                {optionen.sprachen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.spracheId} />
            </div>
            <div>
              <label htmlFor="niveauId" className="label">
                Start-Niveau
              </label>
              <select id="niveauId" name="niveauId" defaultValue={kurs?.niveauId ?? ""} required className="input">
                <option value="" disabled>
                  Bitte wählen
                </option>
                {optionen.niveaus.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code}
                    {n.name ? ` — ${n.name}` : ""}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.niveauId} />
            </div>
            <div>
              <label htmlFor="kursartId" className="label">
                Kursart
              </label>
              <select id="kursartId" name="kursartId" defaultValue={kurs?.kursartId ?? ""} required className="input">
                <option value="" disabled>
                  Bitte wählen
                </option>
                {optionen.kursarten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.maxParticipants ? ` (max. ${k.maxParticipants})` : " (individuell)"}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.kursartId} />
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lehrpersonId" className="label">
              Lehrperson
            </label>
            <select id="lehrpersonId" name="lehrpersonId" defaultValue={kurs?.lehrpersonId ?? ""} className="input">
              <option value="">— noch offen —</option>
              {optionen.lehrpersonen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.kuerzel ? ` (${p.kuerzel})` : ""}
                  {p.qualifikationen ? ` · ${p.qualifikationen}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Der Kurscode enthält das Kürzel der Lehrperson — bleibt bei Wechsel stabil.
            </p>
          </div>
          <div>
            <label htmlFor="maxParticipants" className="label">
              Teilnehmende max.
              {gewaehlteKursart?.maxParticipants ? ` (Kursart: ${gewaehlteKursart.maxParticipants})` : ""}
            </label>
            <input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min={1}
              max={30}
              defaultValue={kurs?.maxParticipants ?? ""}
              className="input"
              placeholder={gewaehlteKursart?.maxParticipants ? `Standard ${gewaehlteKursart.maxParticipants}` : "leer = Kursart-Standard"}
            />
            <FieldError message={state.fieldErrors?.maxParticipants} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Wöchentlicher Fixtermin (Lektionsgenerierung)
        </legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="hatTermin"
            value="1"
            checked={hatTermin}
            onChange={(e) => setHatTermin(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          Kurs hat einen fixen Wochentermin
        </label>
        <p className="-mt-2 text-xs text-slate-500">
          Ohne Termin werden keine Lektionen automatisch generiert (z.B. individuell abgemachte
          Firmenkurse). Kein Kurs startet nach 21:00.
        </p>
        {hatTermin && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="wochentag" className="label">
                Wochentag
              </label>
              <select id="wochentag" name="wochentag" defaultValue={kurs?.wochentag ?? ""} required className="input">
                <option value="" disabled>
                  Bitte wählen
                </option>
                {WOCHENTAGE.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.wochentag} />
            </div>
            <div>
              <label htmlFor="startZeit" className="label">
                Startzeit
              </label>
              <input
                id="startZeit"
                name="startZeit"
                type="time"
                min="06:30"
                max="21:00"
                step={300}
                defaultValue={kurs?.startZeit ?? ""}
                required
                className="input"
              />
              <FieldError message={state.fieldErrors?.startZeit} />
            </div>
            <div>
              <label htmlFor="dauerMinuten" className="label">
                Lektionsdauer
              </label>
              <select
                id="dauerMinuten"
                name="dauerMinuten"
                defaultValue={kurs?.dauerMinuten ?? ""}
                required
                className="input"
              >
                <option value="" disabled>
                  Bitte wählen
                </option>
                {optionen.dauern.map((d) => (
                  <option key={d} value={d}>
                    {d} Minuten
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.dauerMinuten} />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kursort</legend>
        <div className="flex gap-6 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="kursort"
              value="intern"
              checked={kursort === "intern"}
              onChange={() => setKursort("intern")}
              className="h-4 w-4 accent-brand-700"
            />
            In der Schule (Raum)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="kursort"
              value="extern"
              checked={kursort === "extern"}
              onChange={() => setKursort("extern")}
              className="h-4 w-4 accent-brand-700"
            />
            Kursort extern (Firmenkurs vor Ort — nicht im Raumplaner)
          </label>
        </div>
        {kursort === "intern" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="standort" className="label">
                Standort
              </label>
              <select
                id="standort"
                value={standortId}
                onChange={(e) => setStandortId(e.target.value)}
                className="input"
              >
                {optionen.standorte.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="standardRaumId" className="label">
                Standard-Raum
              </label>
              <select
                id="standardRaumId"
                name="standardRaumId"
                defaultValue={kurs?.standardRaumId ?? ""}
                className="input"
              >
                <option value="">— bei jeder Lektion neu verteilen —</option>
                {raeumeImStandort.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.etageName} · {r.name}
                    {r.seats > 0 ? ` (${r.seats} Plätze)` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Online-Kurse können ohne Raum geführt werden (Teilnahme von zu Hause).
              </p>
              <FieldError message={state.fieldErrors?.standardRaumId} />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="externOrt" className="label">
              Kursort extern
            </label>
            <input
              id="externOrt"
              name="externOrt"
              defaultValue={kurs?.externOrt ?? ""}
              className="input"
              placeholder="z.B. Firmenadresse, St. Gallen"
            />
            <FieldError message={state.fieldErrors?.externOrt} />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Zuordnung</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kostentraegerId" className="label">
              Kostenträger (Firmenkurs)
            </label>
            <select id="kostentraegerId" name="kostentraegerId" defaultValue={kurs?.kostentraegerId ?? ""} className="input">
              <option value="">— kein Kostenträger am Kurs —</option>
              {optionen.kostentraeger.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Rechnungs-Hinweis; die Abrechnung pro Anmeldung folgt in Modul 5/9.</p>
          </div>
          <div>
            <label htmlFor="notizen" className="label">
              Notizen
            </label>
            <textarea id="notizen" name="notizen" rows={2} defaultValue={kurs?.notizen ?? ""} className="input" />
          </div>
        </div>
      </fieldset>

      <SubmitButton>{isEdit ? "Änderungen speichern" : "Kurs anlegen"}</SubmitButton>
    </form>
  );
}
