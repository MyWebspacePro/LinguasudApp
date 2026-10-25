"use client";

import { RECHNUNG_STATUS_LABELS, type RechnungStatus } from "@/lib/rechnungen/logik";

const STILE: Record<RechnungStatus, string> = {
  ENTWURF: "bg-slate-200 text-slate-600",
  VERSENDET: "bg-sky-100 text-sky-800",
  TEILBEZAHLT: "bg-amber-100 text-amber-800",
  BEZAHLT: "bg-emerald-100 text-emerald-800",
  STORNIERT: "bg-red-100 text-red-800",
};

export function RechnungsStatusBadge({ status }: { status: RechnungStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${STILE[status]}`}>
      {RECHNUNG_STATUS_LABELS[status]}
    </span>
  );
}

/** «überfällig» ist abgeleitet (versendet/teilbezahlt + Fälligkeit verstrichen). */
export function UeberfaelligBadge() {
  return (
    <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
      überfällig
    </span>
  );
}
