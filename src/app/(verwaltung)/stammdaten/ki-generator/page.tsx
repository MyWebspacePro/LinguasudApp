import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageKiEinstellungen } from "@/lib/auth/permissions";
import { getKiEinstellungenMaskiert } from "@/lib/ki/einstellungen";
import { ladeKiModelle } from "@/lib/ki/modelle";
import { KiEinstellungenForm } from "@/components/ki/KiEinstellungenForm";

export const metadata: Metadata = {
  title: "KI-Lektor — Einstellungen",
};

export default function KiEinstellungenPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <KiEinstellungenContent />
    </Suspense>
  );
}

async function KiEinstellungenContent() {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManageKiEinstellungen(roles)) redirect("/stammdaten");

  const [einstellungen, modellListe] = await Promise.all([
    getKiEinstellungenMaskiert(),
    ladeKiModelle(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">KI-Lektor — Einstellungen</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            OpenRouter-API-Key und Modell hinterlegen. Die Änderungen wirken sofort auf die nächste
            Generierung — ohne Neustart.
          </p>
        </div>
        <Link href="/stammdaten" className="btn-secondary">
          Zurück zu den Stammdaten
        </Link>
      </div>

      <div className="alert-info">
        Der API-Key liegt ausschliesslich auf dem Server (SystemSetting) und wird nie im Klartext an
        den Browser ausgeliefert. Jede Änderung landet im Audit-Log — ohne den Key.
      </div>

      <KiEinstellungenForm
        keyMaskiert={einstellungen.keyMaskiert}
        keyGesetzt={einstellungen.keyGesetzt}
        modell={einstellungen.modell}
        modelle={modellListe.modelle}
        keyQuelle={einstellungen.keyQuelle}
        modellQuelle={einstellungen.modellQuelle}
        modellListeQuelle={modellListe.quelle}
      />

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">So aktivierst du den KI-Lektor</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>OpenRouter-API-Key bei openrouter.ai erstellen und hier eintragen.</li>
          <li>Ein günstiges Modell wählen (z. B. <code>openai/gpt-4o-mini</code>).</li>
          <li>Speichern — die Generierung ist danach sofort aktiv.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Ohne Key bleibt der KI-Lektor sichtbar, ist aber deaktiviert. Die Modellliste wird bevorzugt
          live von OpenRouter geladen; bei Ausfällen greift eine kuratierte Fallback-Liste.
        </p>
      </div>
    </div>
  );
}
