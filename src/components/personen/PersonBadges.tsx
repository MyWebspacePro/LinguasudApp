import type { PersonStatus } from "@/lib/domain";
import { PERSON_STATUS_LABELS } from "@/lib/domain";

const STATUS_STYLES: Record<PersonStatus, string> = {
  INTERESSENT: "border-amber-200 bg-amber-50 text-amber-800",
  AKTIV: "border-emerald-200 bg-emerald-50 text-emerald-800",
  INAKTIV: "border-slate-200 bg-slate-100 text-slate-600",
};

/** Status-Badge der Personen-Kartei (Interessent/in → aktiv → inaktiv). */
export function PersonStatusBadge({ status }: { status: PersonStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {PERSON_STATUS_LABELS[status]}
    </span>
  );
}

/** Kürzel-Chip für Lehrpersonen (wird in Kurscodes referenziert). */
export function KuerzelBadge({ kuerzel }: { kuerzel: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-800">
      {kuerzel}
    </span>
  );
}
