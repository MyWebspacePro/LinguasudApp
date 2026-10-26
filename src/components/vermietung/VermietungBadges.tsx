import type { VermietungStatus } from "@/lib/db";

/** Status-Badge einer Vermietung (Modul 12). */
export function VermietungsStatusBadge({ status }: { status: VermietungStatus }) {
  const klassen =
    status === "FINDET_STATT"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "ABGESAGT"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-line bg-slate-100 text-slate-700";
  const label = status === "FINDET_STATT" ? "findet statt" : status === "ABGESAGT" ? "abgesagt" : "geplant";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${klassen}`}>
      {label}
    </span>
  );
}
