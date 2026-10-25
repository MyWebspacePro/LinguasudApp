"use client";

import type { AnmeldungStatus } from "@/lib/domain";

const STILE: Record<AnmeldungStatus, string> = {
  PROBE: "bg-sky-100 text-sky-800",
  AKTIV: "bg-emerald-100 text-emerald-800",
  BEENDET: "bg-slate-200 text-slate-600",
};

export function AnmeldungStatusBadge({ status }: { status: AnmeldungStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${STILE[status]}`}>
      {status === "PROBE" ? "Probe" : status === "AKTIV" ? "aktiv" : "beendet"}
    </span>
  );
}
