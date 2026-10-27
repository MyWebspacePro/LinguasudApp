import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { fromDbTime } from "@/lib/db";
import { timeFromMinutes, utcToZoned } from "@/lib/zeit";
import { PopupForm, PopupLoeschenButton, type PopupEingaben } from "@/components/website/WebsiteFormen";

export const metadata: Metadata = {
  title: "Pop-up bearbeiten",
};

/** DB-DateTime (UTC-String) → datetime-local-Wert in Schul-Lokalzeit. */
function dbZuDatetimeLocal(dbZeit: string | Date | null): string {
  if (!dbZeit) return "";
  const teile = utcToZoned(fromDbTime(String(dbZeit)));
  return `${teile.dateKey}T${timeFromMinutes(teile.minuteOfDay)}`;
}

/** Pop-up-Editor (Modul 15): Text, Bild, aktiv/inaktiv, Zeitfenster. */
export default async function PopupEditorPage({
  params,
}: {
  params?: Promise<{ id?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <EditorContent id={(await params)?.id ?? ""} />
    </Suspense>
  );
}

async function EditorContent({ id }: { id: string }) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canManageWebsite(roles)) {
    redirect("/dashboard");
  }

  const neu = id === "neu" || id === "";
  let daten: PopupEingaben;
  if (neu) {
    daten = {
      id: null,
      titel: "",
      text: "",
      bildUrl: "",
      buttonLabel: "",
      buttonUrl: "",
      aktiv: false,
      gueltigVon: "",
      gueltigBis: "",
    };
  } else {
    const popup = await db.orm.public.WebsitePopup.where({ id }).first();
    if (!popup) notFound();
    daten = {
      id: popup.id,
      titel: popup.titel,
      text: popup.text,
      bildUrl: popup.bildUrl ?? "",
      buttonLabel: popup.buttonLabel ?? "",
      buttonUrl: popup.buttonUrl ?? "",
      aktiv: popup.aktiv,
      gueltigVon: dbZuDatetimeLocal(popup.gueltigVon),
      gueltigBis: dbZuDatetimeLocal(popup.gueltigBis),
    };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">
        {neu ? "Neues Pop-up" : "Pop-up bearbeiten"}
      </h1>
      <div className="card p-6">
        <PopupForm popup={daten} />
      </div>
      {daten.id && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Gefährliche Aktionen</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">Pop-up endgültig löschen.</p>
          <PopupLoeschenButton popupId={daten.id} />
        </div>
      )}
    </div>
  );
}
