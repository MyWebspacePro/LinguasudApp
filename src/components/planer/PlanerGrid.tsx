"use client";

import { useActionState, useState } from "react";
import { fixiereLektionAction, sageLektionAbAction, verschiebeLektionAction } from "@/lib/planer/actions";
import {
  schliesseLektionAbAction,
  speichereAnwesenheitAction,
} from "@/lib/anwesenheit/actions";
import { ANWESENHEIT_STATUS_LABELS } from "@/lib/anwesenheit/logik";
import { idleFormState } from "@/lib/forms";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDatum, timeFromMinutes } from "@/lib/zeit";
import { VERMIETUNG_STATUS_LABELS } from "@/lib/domain";
import type { AnwesenheitStatus, KursStatus, LektionStatus, VermietungStatus } from "@/lib/db";

/** Spaltenstruktur: Standort → Etage → Räume (flat für das CSS-Grid). */
export interface PlanerSpalten {
  standortId: string;
  standortName: string;
  etagen: {
    etageName: string;
    raeume: { id: string; name: string }[];
  }[];
}

/** Anwesenheits-Zeile einer beendeten Lektion (Server → Client). */
export interface AnwesenheitEintrag {
  anmeldungId: string;
  personName: string;
  /** Probe-Anmeldung: erscheint in der Liste, wird ohne Abbuchung erfasst. */
  probe: boolean;
  status: AnwesenheitStatus | null;
  bemerkung: string | null;
  vonLehrperson: boolean;
}

/** Serialisierte Planer-Lektion (Server → Client). */
export interface PlanerLektion {
  id: string;
  kursId: string;
  kursCode: string;
  kursStatus: KursStatus;
  unterbrochen: boolean;
  spracheName: string;
  niveauCode: string;
  kursartName: string;
  lehrpersonName: string | null;
  lehrKuerzel: string | null;
  raumId: string | null;
  raumLabel: string | null;
  startMinute: number;
  dauerMinuten: number;
  status: LektionStatus;
  quelle: string;
  /** Aktueller Nutzer ist die Lehrperson dieser Lektion (Absage-Grundlage). */
  istMeineLektion: boolean;
  /** Nur bei beendeten Lektionen gesetzt (Ende vorbei, nicht abgesagt). */
  anwesenheit?: {
    kannErfassen: boolean;
    fensterAbgelaufen: boolean;
    eintraege: AnwesenheitEintrag[];
  };
}

export interface PlanerPanelOptionen {
  raeume: { id: string; label: string }[];
  heuteKey: string;
}

/** Serialisierte Vermietung im Planer (Modul 12) — deutlich andere Farbe. */
export interface PlanerVermietung {
  id: string;
  mieterName: string;
  raumId: string;
  raumLabel: string | null;
  startMinute: number;
  dauerMinuten: number;
  status: VermietungStatus;
  preisChf: number;
  notiz: string | null;
  ausSerie: boolean;
}

const PX_PRO_MINUTE = 1;
const RASTER_HOEHE = (23 * 60 - (6 * 60 + 30)) * PX_PRO_MINUTE;
const FENSTER_VON = 6 * 60 + 30;
/** Mindestbreite einer Raumspalte — 17 Räume passen so ohne horizontales Scrollen. */
const SPALTE_MIN = 60;
const ZEIT_SPALTE = 56;

interface FlatSpalte {
  key: string;
  label: string;
  etageLabel?: string;
  standortLabel?: string;
}

export function PlanerGrid({
  tag,
  spalten,
  lektionen,
  vermietungen = [],
  konfliktIds,
  onlineSpalte,
  optionen,
  canManage,
}: {
  tag: string;
  spalten: PlanerSpalten[];
  lektionen: PlanerLektion[];
  vermietungen?: PlanerVermietung[];
  konfliktIds: string[];
  onlineSpalte: boolean;
  optionen: PlanerPanelOptionen;
  canManage: boolean;
}) {
  const [ausgewaehlt, setAusgewaehlt] = useState<PlanerLektion | null>(null);
  const [ausgewaehlteVermietung, setAusgewaehlteVermietung] = useState<PlanerVermietung | null>(null);
  const konflikte = new Set(konfliktIds);

  // Flat-Liste der Spalten (Reihenfolge = Spaltenreihenfolge im Grid).
  const flat: FlatSpalte[] = [];
  for (const s of spalten) {
    for (const e of s.etagen) {
      for (const r of e.raeume) {
        flat.push({ key: r.id, label: r.name, etageLabel: e.etageName, standortLabel: s.standortName });
      }
    }
  }
  if (onlineSpalte) flat.push({ key: "online", label: "Online / ohne Raum" });

  const template = `${ZEIT_SPALTE}px repeat(${flat.length}, minmax(${SPALTE_MIN}px, 1fr))`;

  // Gruppierungen für die Kopfzeilen (Span = Anzahl Räume).
  const standortGruppen: { label: string; span: number }[] = [];
  const etageGruppen: { label: string; span: number }[] = [];
  for (const s of spalten) {
    const n = s.etagen.reduce((sum, e) => sum + e.raeume.length, 0);
    if (n > 0) standortGruppen.push({ label: s.standortName, span: n });
    for (const e of s.etagen) {
      if (e.raeume.length > 0) etageGruppen.push({ label: e.etageName, span: e.raeume.length });
    }
  }
  if (onlineSpalte) {
    standortGruppen.push({ label: "Online", span: 1 });
    etageGruppen.push({ label: "—", span: 1 });
  }

  const lektionenIn = (raumId: string) =>
    lektionen.filter((l) => (raumId === "online" ? l.raumId === null : l.raumId === raumId));

  // Vermietungen haben immer einen Raum — in der Online-Spalte nie zeigen.
  const vermietungenIn = (raumId: string) =>
    raumId === "online" ? [] : vermietungen.filter((v) => v.raumId === raumId);

  return (
    <div className="space-y-4">
      {flat.length > 0 ? (
        <div className="card overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: template, minWidth: `${ZEIT_SPALTE + flat.length * SPALTE_MIN}px` }}>
            {/* Kopfzeile 1: Standorte */}
            <div className="border-r border-b border-line" />
            {standortGruppen.map((g, i) => (
              <div
                key={`s-${i}`}
                className="truncate border-r border-b border-line bg-surface/60 px-2 py-1.5 text-center text-xs font-semibold text-brand-800"
                style={{ gridColumn: `span ${g.span}` }}
                title={g.label}
              >
                {g.label}
              </div>
            ))}
            {/* Kopfzeile 2: Etagen */}
            <div className="border-r border-b border-line" />
            {etageGruppen.map((g, i) => (
              <div
                key={`e-${i}`}
                className="truncate border-r border-b border-line bg-surface/40 px-1 py-1 text-center text-[11px] text-slate-500"
                style={{ gridColumn: `span ${g.span}` }}
                title={g.label}
              >
                {g.label}
              </div>
            ))}
            {/* Kopfzeile 3: Räume */}
            <div className="border-r border-b border-line" />
            {flat.map((c) => (
              <div
                key={`r-${c.key}`}
                className="truncate border-r border-b border-line bg-surface/60 px-1 py-1.5 text-center text-xs font-semibold"
                title={c.etageLabel ? `${c.standortLabel} · ${c.etageLabel} · ${c.label}` : c.label}
              >
                {c.label}
              </div>
            ))}

            {/* Zeitraster: Zeitspalte + Raumspalten */}
            <div className="relative border-r border-line" style={{ height: RASTER_HOEHE }}>
              {stundenLabels().map((m) => (
                <span
                  key={m}
                  className="absolute -translate-y-1/2 pr-1 text-right text-[10px] text-slate-400"
                  style={{ top: (m - FENSTER_VON) * PX_PRO_MINUTE, width: "100%" }}
                >
                  {timeFromMinutes(m)}
                </span>
              ))}
            </div>
            {flat.map((c) => (
              <RaumSpalte
                key={c.key}
                lektionen={lektionenIn(c.key)}
                vermietungen={vermietungenIn(c.key)}
                konflikte={konflikte}
                ausgewaehltId={ausgewaehlt?.id ?? null}
                ausgewaehlteVermietungId={ausgewaehlteVermietung?.id ?? null}
                onSelect={setAusgewaehlt}
                onSelectVermietung={setAusgewaehlteVermietung}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="card p-8 text-center text-sm text-slate-600">
          Keine Räume erfasst — bitte zuerst Standorte/Räume in den Stammdaten pflegen.
        </p>
      )}

      {ausgewaehlt && (
        <LektionPanel
          lektion={ausgewaehlt}
          tag={tag}
          optionen={optionen}
          canManage={canManage}
          onClose={() => setAusgewaehlt(null)}
        />
      )}

      {ausgewaehlteVermietung && (
        <VermietungPanel
          vermietung={ausgewaehlteVermietung}
          tag={tag}
          canManage={canManage}
          onClose={() => setAusgewaehlteVermietung(null)}
        />
      )}
    </div>
  );
}

function RaumSpalte({
  lektionen,
  vermietungen,
  konflikte,
  ausgewaehltId,
  ausgewaehlteVermietungId,
  onSelect,
  onSelectVermietung,
}: {
  lektionen: PlanerLektion[];
  vermietungen: PlanerVermietung[];
  konflikte: Set<string>;
  ausgewaehltId: string | null;
  ausgewaehlteVermietungId: string | null;
  onSelect: (l: PlanerLektion) => void;
  onSelectVermietung: (v: PlanerVermietung) => void;
}) {
  return (
    <div
      className="relative border-r border-line"
      style={{
        height: RASTER_HOEHE,
        // Halbstundenraster (Linie auf jeder 30. Minute)
        backgroundImage: "repeating-linear-gradient(to bottom, #e7e4df 0, #e7e4df 1px, transparent 1px, transparent 30px)",
      }}
    >
      {lektionen.map((l) => {
        const ueberbuchbar = l.kursStatus !== "AKTIV" && l.kursStatus !== "GEPLANT";
        const grau = ueberbuchbar || l.unterbrochen;
        const konflikt = konflikte.has(l.id);
        const abgesagt = l.status === "ABGESAGT";
        const fixiert = l.status === "FIXIERT";
        const durchgefuehrt = l.status === "DURCHGEFUEHRT";
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onSelect(l)}
            className={[
              "group absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1 text-left text-[10px] leading-tight transition",
              abgesagt
                ? "border-red-200 bg-red-50/80 text-red-400 line-through"
                : durchgefuehrt
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : grau
                    ? "border-slate-300 bg-slate-200/80 text-slate-500"
                    : fixiert
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-brand-300 bg-brand-100 text-brand-900",
              konflikt && !abgesagt ? "ring-2 ring-red-500 ring-offset-0" : "",
              ausgewaehltId === l.id ? "outline outline-2 outline-offset-1 outline-slate-800" : "",
            ].join(" ")}
            style={{ top: (l.startMinute - FENSTER_VON) * PX_PRO_MINUTE, height: Math.max(18, l.dauerMinuten * PX_PRO_MINUTE) - 2 }}
            title={tooltipText(l, konflikt)}
          >
            <span className="block truncate font-semibold">{l.lehrKuerzel ?? "—"}</span>
            {l.dauerMinuten >= 60 && (
              <span className="block truncate opacity-80">
                {timeFromMinutes(l.startMinute)} · {l.niveauCode}
              </span>
            )}
            {/* Details beim Hover (CSS-Karte) */}
            <span className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-60 -translate-x-1/2 rounded-lg border border-line bg-paper p-2.5 text-left text-[11px] font-normal normal-case leading-snug text-slate-700 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">
              <span className="mb-1 block font-mono text-[10px] font-bold text-brand-800">{l.kursCode}</span>
              <span className="block">
                {l.spracheName} · {l.niveauCode} · {l.kursartName}
              </span>
              <span className="block">Lehrperson: {l.lehrpersonName ?? "offen"}</span>
              <span className="block">
                {timeFromMinutes(l.startMinute)}–{timeFromMinutes(l.startMinute + l.dauerMinuten)} · {l.raumLabel ?? "ohne Raum"}
              </span>
              <span className="block">
                {statusText(l)}
                {grau ? " · pausiert/unterbrochen → überbuchbar" : ""}
                {konflikt ? " · KONFLIKT: Doppelbelegung" : ""}
              </span>
            </span>
          </button>
        );
      })}

      {/* Vermietungsblöcke (Modul 12): deutlich andere Farbe (amber), Hover mit
          Mieter/Zeit, abgesagt ausgegraut und überbuchbar. */}
      {vermietungen.map((v) => {
        const abgesagt = v.status === "ABGESAGT";
        const konflikt = konflikte.has(v.id);
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVermietung(v)}
            className={[
              "group absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-dashed px-1 text-left text-[10px] leading-tight transition",
              abgesagt
                ? "border-slate-300 bg-slate-100/90 text-slate-400 line-through"
                : "border-amber-500 bg-amber-100 text-amber-900",
              konflikt && !abgesagt ? "ring-2 ring-red-500 ring-offset-0" : "",
              ausgewaehlteVermietungId === v.id ? "outline outline-2 outline-offset-1 outline-slate-800" : "",
            ].join(" ")}
            style={{ top: (v.startMinute - FENSTER_VON) * PX_PRO_MINUTE, height: Math.max(18, v.dauerMinuten * PX_PRO_MINUTE) - 2 }}
            title={vermietungTooltip(v, konflikt)}
          >
            <span className="block truncate font-semibold">Vermietung</span>
            {v.dauerMinuten >= 60 && (
              <span className="block truncate opacity-80">
                {timeFromMinutes(v.startMinute)} · {v.mieterName}
              </span>
            )}
            <span className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-60 -translate-x-1/2 rounded-lg border border-line bg-paper p-2.5 text-left text-[11px] font-normal normal-case leading-snug text-slate-700 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">
              <span className="mb-1 block text-[10px] font-bold text-amber-700">Raumvermietung{v.ausSerie ? " (Serie)" : ""}</span>
              <span className="block">Mieter: {v.mieterName}</span>
              <span className="block">
                {timeFromMinutes(v.startMinute)}–{timeFromMinutes(v.startMinute + v.dauerMinuten)} · {v.raumLabel ?? "Raum"}
              </span>
              <span className="block">
                {VERMIETUNG_STATUS_LABELS[v.status]} · Preis {v.preisChf.toFixed(2)} CHF
                {konflikt ? " · KONFLIKT: Doppelbelegung" : ""}
                {abgesagt ? " · überbuchbar" : ""}
              </span>
              {v.notiz && <span className="block text-slate-500">{v.notiz}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function statusText(l: PlanerLektion): string {
  switch (l.status) {
    case "ABGESAGT":
      return "abgesagt";
    case "FIXIERT":
      return "fixiert";
    case "DURCHGEFUEHRT":
      return "durchgeführt (Anwesenheit abgeschlossen)";
    default:
      return "provisorisch";
  }
}

function tooltipText(l: PlanerLektion, konflikt: boolean): string {
  const teile = [
    `${l.kursCode}`,
    `${l.spracheName} · ${l.niveauCode} · ${l.kursartName}`,
    `Lehrperson: ${l.lehrpersonName ?? "offen"}`,
    `${timeFromMinutes(l.startMinute)}–${timeFromMinutes(l.startMinute + l.dauerMinuten)} · ${l.raumLabel ?? "ohne Raum"}`,
    statusText(l),
  ];
  const grau = l.kursStatus !== "AKTIV" && l.kursStatus !== "GEPLANT";
  if (grau || l.unterbrochen) teile.push("pausiert/unterbrochen — Slot überbuchbar");
  if (konflikt) teile.push("Konflikt: Doppelbelegung");
  return teile.join("\n");
}

function vermietungTooltip(v: PlanerVermietung, konflikt: boolean): string {
  const teile = [
    `Raumvermietung${v.ausSerie ? " (Serie)" : ""}`,
    `Mieter: ${v.mieterName}`,
    `${timeFromMinutes(v.startMinute)}–${timeFromMinutes(v.startMinute + v.dauerMinuten)} · ${v.raumLabel ?? "Raum"}`,
    `${VERMIETUNG_STATUS_LABELS[v.status]} · Preis ${v.preisChf.toFixed(2)} CHF`,
  ];
  if (v.status === "ABGESAGT") teile.push("abgesagt — Slot überbuchbar");
  if (konflikt) teile.push("Konflikt: Doppelbelegung");
  if (v.notiz) teile.push(v.notiz);
  return teile.join("\n");
}

function stundenLabels(): number[] {
  const labels: number[] = [];
  for (let m = 7 * 60; m <= 23 * 60; m += 60) labels.push(m);
  return labels;
}

/** Klick-Panel einer Vermietung im Planer (Modul 12): Details + Link. */
function VermietungPanel({
  vermietung,
  tag,
  canManage,
  onClose,
}: {
  vermietung: PlanerVermietung;
  tag: string;
  canManage: boolean;
  onClose: () => void;
}) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-amber-700">
            Raumvermietung{vermietung.ausSerie ? " (aus Serie)" : ""}
          </h2>
          <p className="mt-0.5 text-sm text-slate-700">Mieter: {vermietung.mieterName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDatum(tag)} · {timeFromMinutes(vermietung.startMinute)}–
            {timeFromMinutes(vermietung.startMinute + vermietung.dauerMinuten)} · {vermietung.raumLabel ?? "Raum"} ·{" "}
            {VERMIETUNG_STATUS_LABELS[vermietung.status]} · Preis {vermietung.preisChf.toFixed(2)} CHF
          </p>
          {vermietung.notiz && <p className="mt-1 text-xs text-slate-500">{vermietung.notiz}</p>}
        </div>
        <div className="flex gap-2">
          {canManage && (
            <a href={`/vermietungen/${vermietung.id}`} className="btn-secondary px-3 py-1.5 text-xs">
              Vermietung öffnen
            </a>
          )}
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">
            Schliessen
          </button>
        </div>
      </div>
      <p className="mt-3 border-t border-line pt-3 text-xs text-slate-500">
        Vermietungen werden in der Verwaltung unter «Vermietung» gepflegt (Rechnungs-Entwurf mit
        QR-Zahlteil an den Mieter). Doppelbelegungen werden nur markiert, nie blockiert.
      </p>
    </section>
  );
}

/** Klick-Panel einer Lektion: Details + Anwesenheit (Modul 7) + Verschieben/Fixieren/Absagen (Büro). */
function LektionPanel({
  lektion,
  tag,
  optionen,
  canManage,
  onClose,
}: {
  lektion: PlanerLektion;
  tag: string;
  optionen: PlanerPanelOptionen;
  canManage: boolean;
  onClose: () => void;
}) {
  const [moveState, moveAction] = useActionState(verschiebeLektionAction, idleFormState);
  const [fixState, fixAction] = useActionState(fixiereLektionAction, idleFormState);
  const [sageState, sageAction] = useActionState(sageLektionAbAction, idleFormState);
  const anwesenheit = lektion.anwesenheit;
  const abgeschlossen = lektion.status === "DURCHGEFUEHRT";
  // Absage: Büro überall, Lehrperson ihre eigene Lektion (Modul 7).
  const darfAbsagen = canManage || lektion.istMeineLektion;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-sm font-bold text-brand-800">{lektion.kursCode}</h2>
          <p className="mt-0.5 text-sm text-slate-700">
            {lektion.spracheName} · {lektion.niveauCode} · {lektion.kursartName} ·{" "}
            {lektion.lehrpersonName ?? "Lehrperson offen"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDatum(tag)} · {timeFromMinutes(lektion.startMinute)}–
            {timeFromMinutes(lektion.startMinute + lektion.dauerMinuten)} · {lektion.raumLabel ?? "ohne Raum"} ·{" "}
            {statusText(lektion)}
            {lektion.kursStatus === "PAUSIERT" ? " · Kurs pausiert" : ""}
            {lektion.unterbrochen ? " · Kurs unterbrochen" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/kurse/${lektion.kursId}`} className="btn-secondary px-3 py-1.5 text-xs">
            Kurs öffnen
          </a>
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">
            Schliessen
          </button>
        </div>
      </div>

      {anwesenheit && (
        <AnwesenheitSektion lektion={lektion} anwesenheit={anwesenheit} abgeschlossen={abgeschlossen} />
      )}

      {(canManage || darfAbsagen) && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {canManage && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Verschieben (provisorisch)
                </h3>
                <form action={moveAction} className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
                  <input type="hidden" name="lektionId" value={lektion.id} />
                  <div>
                    <label htmlFor="mv-datum" className="label">
                      Datum
                    </label>
                    <input id="mv-datum" name="datum" type="date" defaultValue={tag} required className="input" />
                  </div>
                  <div>
                    <label htmlFor="mv-zeit" className="label">
                      Start
                    </label>
                    <input
                      id="mv-zeit"
                      name="zeit"
                      type="time"
                      step={300}
                      defaultValue={timeFromMinutes(lektion.startMinute)}
                      required
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="mv-raum" className="label">
                      Raum
                    </label>
                    <select id="mv-raum" name="raumId" defaultValue={lektion.raumId ?? ""} className="input">
                      <option value="">ohne Raum (Online)</option>
                      {optionen.raeume.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <SubmitButton className="btn-secondary" pendingText="…">
                      Verschieben
                    </SubmitButton>
                  </div>
                  <div className="sm:col-span-4">
                    <FormAlert state={moveState} />
                  </div>
                </form>
              </div>

              <div className="flex flex-wrap items-start gap-6">
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Fixieren</h3>
                  <form action={fixAction}>
                    <input type="hidden" name="lektionId" value={lektion.id} />
                    <SubmitButton pendingText="…">Fixieren (bindend)</SubmitButton>
                  </form>
                  <div className="mt-1">
                    <FormAlert state={fixState} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Fixiert + Zeit/Raum weicht vom Wochentermin ab → Teilnehmende werden informiert.
                  </p>
                </div>
              </div>
            </>
          )}
          {darfAbsagen && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Absagen {canManage ? "" : "(Lehrperson)"}
              </h3>
              <form action={sageAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="lektionId" value={lektion.id} />
                <div>
                  <label htmlFor="sa-grund" className="label">
                    Grund (Pflicht)
                  </label>
                  <input id="sa-grund" name="grund" className="input" placeholder="z.B. Lehrperson erkrankt" required />
                </div>
                <div className="pb-0.5">
                  <SubmitButton className="btn-danger" pendingText="…">
                    Absagen
                  </SubmitButton>
                </div>
              </form>
              <div className="mt-1">
                <FormAlert state={sageState} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Teilnehmende werden automatisch informiert — kein Guthaben-Abzug.
              </p>
            </div>
          )}
        </div>
      )}
      {!canManage && !darfAbsagen && (
        <p className="mt-3 border-t border-line pt-3 text-xs text-slate-500">
          Nur das Büro verschiebt und fixiert Lektionen — als Lehrperson können Sie Ihre eigene
          Lektion innerhalb von 24 h absagen und die Anwesenheit erfassen.
        </p>
      )}
    </section>
  );
}

const ANWESENHEIT_OPTIONEN: AnwesenheitStatus[] = ["ANWESEND", "ABWESEND_ENTSCHULDIGT", "ABWESEND_UNENTSCHULDIGT"];

/** Anwesenheits-Erfassung (Modul 7): je Teilnehmende(r) ein Status, Abschliessen bucht das Guthaben. */
function AnwesenheitSektion({
  lektion,
  anwesenheit,
  abgeschlossen,
}: {
  lektion: PlanerLektion;
  anwesenheit: NonNullable<PlanerLektion["anwesenheit"]>;
  abgeschlossen: boolean;
}) {
  const [speicherState, speicherAction] = useActionState(speichereAnwesenheitAction, idleFormState);
  const [schlussState, schlussAction] = useActionState(schliesseLektionAbAction, idleFormState);

  const vollstaendig = anwesenheit.eintraege.filter((e) => !e.probe).every((e) => e.status !== null);

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Anwesenheit {abgeschlossen ? "· abgeschlossen (Büro kann korrigieren)" : ""}
        </h3>
        <form action={schlussAction}>
          <input type="hidden" name="lektionId" value={lektion.id} />
          {abgeschlossen ? null : (
            <SubmitButton className="btn-primary" pendingText="…" disabled={!vollstaendig}>
              Lektion abschliessen (bucht Guthaben)
            </SubmitButton>
          )}
        </form>
      </div>
      {!vollstaendig && (
        <p className="text-xs text-slate-500">
          Abschliessen erst, wenn alle aktiven Teilnehmenden erfasst sind (anwesend −1 · unentschuldigt −1 ·
          entschuldigt −0 · Probe ohne Abbuchung).
        </p>
      )}
      {anwesenheit.fensterAbgelaufen && !abgeschlossen && (
        <p className="alert-info text-xs">
          Das 24-h-Fenster der Lehrperson ist abgelaufen — nur das Büro kann jetzt noch erfassen.
        </p>
      )}
      {anwesenheit.eintraege.length === 0 ? (
        <p className="text-sm text-slate-600">Keine aktiven oder Probe-Anmeldungen in diesem Kurs.</p>
      ) : (
        <ul className="space-y-2">
          {anwesenheit.eintraege.map((eintrag) => (
            <li key={eintrag.anmeldungId} className="rounded-lg border border-line bg-surface/40 p-3">
              <form action={speicherAction} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <input type="hidden" name="lektionId" value={lektion.id} />
                <input type="hidden" name="anmeldungId" value={eintrag.anmeldungId} />
                <span className="min-w-40 text-sm font-medium text-slate-800">
                  {eintrag.personName}
                  {eintrag.probe && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Probe
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-3">
                  {ANWESENHEIT_OPTIONEN.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        defaultChecked={eintrag.status === s}
                        disabled={!anwesenheit.kannErfassen}
                        required
                      />
                      {ANWESENHEIT_STATUS_LABELS[s]}
                    </label>
                  ))}
                </div>
                <input
                  name="bemerkung"
                  className="input flex-1 py-1.5 text-sm"
                  placeholder="Bemerkung (optional)"
                  defaultValue={eintrag.bemerkung ?? ""}
                  disabled={!anwesenheit.kannErfassen}
                />
                {anwesenheit.kannErfassen && (
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">
                    Speichern
                  </SubmitButton>
                )}
                {eintrag.vonLehrperson && (
                  <span className="text-[10px] text-slate-400">von Lehrperson erfasst</span>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
      <FormAlert state={speicherState} />
      <FormAlert state={schlussState} />
      {abgeschlossen && (
        <p className="text-xs text-slate-500">
          Guthaben wurde gebucht — Korrekturen durchs Büro passen den Journal-Eintrag an (Audit-Log).
        </p>
      )}
    </div>
  );
}
