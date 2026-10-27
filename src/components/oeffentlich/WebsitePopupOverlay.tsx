"use client";

// Pop-up-Overlay (Modul 15): Inhalt kommt serverseitig (SSR) — die Karte ist
// also im ersten HTML enthalten und flackert nicht. Das Schliessen setzt per
// Server-Action einen Tages-Cookie; die nächste Seite liefert das Pop-up dann
// gar nicht mehr aus (serverseitig gesteuert, nicht nur clientseitig versteckt).

import { useState, useTransition } from "react";
import { popupSchliessenAction } from "@/lib/website/actions";

export interface PopupDaten {
  id: string;
  titel: string;
  text: string;
  bildUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
}

export function WebsitePopupOverlay({ popup }: { popup: PopupDaten }) {
  const [geschlossen, setGeschlossen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (geschlossen) return null;

  const schliessen = () => {
    setGeschlossen(true);
    startTransition(async () => {
      try {
        await popupSchliessenAction(popup.id);
      } catch {
        // Cookie-Fehlschlag darf die UI nicht brechen — Pop-up bleibt zu.
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={popup.titel}
    >
      <div className="card w-full max-w-md overflow-hidden p-0">
        {popup.bildUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={popup.bildUrl} alt="" className="max-h-56 w-full object-cover" />
        )}
        <div className="space-y-3 p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{popup.titel}</h2>
            <button
              type="button"
              onClick={schliessen}
              disabled={pending}
              aria-label="Schliessen"
              className="-mt-1 rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
          <p className="whitespace-pre-line text-sm text-slate-700">{popup.text}</p>
          {popup.buttonLabel && popup.buttonUrl && (
            <a href={popup.buttonUrl} className="btn-primary" onClick={schliessen}>
              {popup.buttonLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
