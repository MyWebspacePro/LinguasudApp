import type { Role } from "@/lib/domain";
import { ROLE_LABELS } from "@/lib/auth/permissions";

const ROLE_STYLES: Record<Role, string> = {
  ADMIN: "border-brand-300 bg-brand-100 text-brand-900",
  CHEF: "border-brand-200 bg-brand-50 text-brand-800",
  BUERO: "border-sky-200 bg-sky-50 text-sky-800",
  LEHRPERSON: "border-emerald-200 bg-emerald-50 text-emerald-800",
  TEILNEHMER: "border-slate-200 bg-slate-50 text-slate-600",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${ROLE_STYLES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
