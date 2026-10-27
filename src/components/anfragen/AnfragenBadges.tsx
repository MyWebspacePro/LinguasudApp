// Status-Badges der Anfragen & Aufgaben (Modul 13) — kompakte Farbcodierung
// wie in den übrigen Modulen.

const ANFRAGE_FARBE: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  IN_BEARBEITUNG: "bg-sky-100 text-sky-800",
  ZUGEORDNET: "bg-emerald-100 text-emerald-800",
  ABGELEHNT: "bg-slate-200 text-slate-600",
};

const ANFRAGE_LABEL: Record<string, string> = {
  OFFEN: "offen",
  IN_BEARBEITUNG: "in Bearbeitung",
  ZUGEORDNET: "zugeordnet",
  ABGELEHNT: "abgelehnt",
};

export function AnfrageStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ANFRAGE_FARBE[status] ?? "bg-slate-100 text-slate-600"}`}>
      {ANFRAGE_LABEL[status] ?? status}
    </span>
  );
}

export function AufgabeStatusBadge({ status }: { status: string }) {
  const farbe = status === "OFFEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  const label = status === "OFFEN" ? "offen" : "erledigt";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${farbe}`}>{label}</span>;
}
