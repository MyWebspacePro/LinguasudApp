import "server-only";

// Mahn-Job (Modul 9): prüft alle 30 Minuten die versendeten, unbezahlten
// Rechnungen — Stufe 1 (freundliche Erinnerung) 10 Tage nach Fälligkeit,
// Stufe 2 (Mahnung) 30 Tage nach Fälligkeit, jede Stufe genau einmal
// (mahnStufe ist der Idempotenz-Marker, kein Tages-Marker nötig).

import { db } from "@/lib/db";
import { heuteDateKey } from "@/lib/zeit";
import { naechsteMahnStufe } from "./logik";
import { versendeMahnung } from "./mahnung";

const INTERVAL_MS = 30 * 60 * 1000;

/** Ein Mahn-Lauf: versendet fällige Mahn-Stufen, gibt die Anzahl zurück. */
export async function mahnLauf(): Promise<{ versendet: number }> {
  const heute = heuteDateKey();
  const rechnungen = await db.orm.public.Rechnung
    .where((r) => r.status.in(["VERSENDET", "TEILBEZAHLT"]))
    .all();

  let versendet = 0;
  for (const rechnung of rechnungen) {
    const stufe = naechsteMahnStufe(
      rechnung.status as "VERSENDET" | "TEILBEZAHLT",
      rechnung.mahnStufe,
      rechnung.faelligAm.slice(0, 10),
      heute,
    );
    if (!stufe) continue;
    const ergebnis = await versendeMahnung(rechnung.id, stufe);
    console.log(
      `[mahnjob] Rechnung ${rechnung.nummer}: Stufe ${stufe} versendet${ergebnis.hinweis}`,
    );
    if (ergebnis.versendet) versendet++;
  }
  return { versendet };
}

let gestartet = false;

/** Startet den Job (einmalig pro Prozess; aus instrumentation.ts gerufen). */
export function startMahnJob(): void {
  if (gestartet) return;
  gestartet = true;

  // Beim Start nachziehen (z.B. nach Deployment oder Dev-Restart).
  void mahnLauf().catch((error) => {
    console.error("Mahn-Job (Start) fehlgeschlagen:", error);
  });

  const timer = setInterval(() => {
    void mahnLauf().catch((error) => {
      console.error("Mahn-Job fehlgeschlagen:", error);
    });
  }, INTERVAL_MS);

  // Der Timer soll den Prozess nicht am Beenden hindern.
  timer.unref?.();
}
