import "server-only";

// Nächtlicher Lektions-Job (Modul 6): rollierende Generierung zwei Wochen im
// Voraus. Der Prozess prüft alle 30 Minuten einen Tages-Marker; nach
// Mitternacht (Schul-Zeitzone) läuft die Generierung einmalig. Kein externes
// Cron nötig — die App läuft als einzelner Container.

import { naechtlicherLauf } from "./lektionsgenerierung";

const INTERVAL_MS = 30 * 60 * 1000;

let gestartet = false;

/** Startet den Job (einmalig pro Prozess; aus instrumentation.ts gerufen). */
export function startLektionsJob(): void {
  if (gestartet) return;
  gestartet = true;

  // Beim Start nachziehen (z.B. nach Deployment oder Dev-Restart).
  void naechtlicherLauf().catch((error) => {
    console.error("Lektions-Job (Start) fehlgeschlagen:", error);
  });

  const timer = setInterval(() => {
    void naechtlicherLauf().catch((error) => {
      console.error("Lektions-Job (nächtlich) fehlgeschlagen:", error);
    });
  }, INTERVAL_MS);

  // Der Timer soll den Prozess nicht am Beenden hindern.
  timer.unref?.();
}
