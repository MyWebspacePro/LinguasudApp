// Konflikt-Erkennung für den Raumplaner (Modul 6, pure). Keine harte
// Konfliktblockade (Pflichtenheft): Konflikte werden nur markiert. Pausierte
// Kurse und Unterbrechungen gelten als überbuchbar und erzeugen keine
// Konflikte; externe Firmenkurse sind gar nicht im Planer.

export interface PlanLektion {
  id: string;
  raumId: string | null;
  /** Minuten seit Mitternacht (Lokalzeit). */
  startMinute: number;
  dauerMinuten: number;
  lehrpersonId: string | null;
  /** true, wenn der Kurs pausiert oder unterbrochen ist → überbuchbar. */
  ueberbuchbar: boolean;
}

/** Ende in Minuten (halboffen; Überschneidung = echter Überlapp). */
function ende(l: PlanLektion): number {
  return l.startMinute + l.dauerMinuten;
}

function ueberlappt(a: PlanLektion, b: PlanLektion): boolean {
  return a.startMinute < ende(b) && b.startMinute < ende(a);
}

/** IDs der Lektionen mit Raum-Doppelbelegung (grösste Schnittmenge markiert). */
export function raumKonflikte(lektionen: readonly PlanLektion[]): Set<string> {
  const konflikt = new Set<string>();
  const mitRaum = lektionen.filter((l) => l.raumId);
  for (let i = 0; i < mitRaum.length; i++) {
    for (let j = i + 1; j < mitRaum.length; j++) {
      const a = mitRaum[i]!;
      const b = mitRaum[j]!;
      if (a.raumId !== b.raumId || !ueberlappt(a, b)) continue;
      if (a.ueberbuchbar && b.ueberbuchbar) continue;
      if (a.ueberbuchbar || b.ueberbuchbar) continue; // überbuchbarer Slot ist nie Konflikt
      konflikt.add(a.id);
      konflikt.add(b.id);
    }
  }
  return konflikt;
}

/** IDs der Lektionen, in denen dieselbe Lehrperson doppelt eingesetzt wäre. */
export function lehrpersonKonflikte(lektionen: readonly PlanLektion[]): Set<string> {
  const konflikt = new Set<string>();
  const mitLehr = lektionen.filter((l) => l.lehrpersonId);
  for (let i = 0; i < mitLehr.length; i++) {
    for (let j = i + 1; j < mitLehr.length; j++) {
      const a = mitLehr[i]!;
      const b = mitLehr[j]!;
      if (a.lehrpersonId !== b.lehrpersonId || !ueberlappt(a, b)) continue;
      if (a.ueberbuchbar || b.ueberbuchbar) continue;
      konflikt.add(a.id);
      konflikt.add(b.id);
    }
  }
  return konflikt;
}
