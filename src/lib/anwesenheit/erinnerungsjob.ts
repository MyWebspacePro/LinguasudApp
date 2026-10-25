import "server-only";

// Nächtlicher Anwesenheits-Erinnerungs-Job (Modul 7): erinnert am nächsten
// Tag die Lehrpersonen offener Anwesenheiten (Marker-Pattern wie der
// Lektions-Job, Prüfschleife alle 30 Minuten).

import { naechtlicherErinnerungsLauf } from "./erinnerung";

const INTERVAL_MS = 30 * 60 * 1000;

let gestartet = false;

/** Startet den Job (einmalig pro Prozess; aus instrumentation.ts gerufen). */
export function startAnwesenheitsJob(): void {
  if (gestartet) return;
  gestartet = true;

  // Beim Start nachziehen (z.B. nach Deployment oder Dev-Restart).
  void naechtlicherErinnerungsLauf().catch((error) => {
    console.error("Anwesenheits-Job (Start) fehlgeschlagen:", error);
  });

  const timer = setInterval(() => {
    void naechtlicherErinnerungsLauf().catch((error) => {
      console.error("Anwesenheits-Job (nächtlich) fehlgeschlagen:", error);
    });
  }, INTERVAL_MS);

  // Der Timer soll den Prozess nicht am Beenden hindern.
  timer.unref?.();
}
