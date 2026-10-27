// Zustand des KI-Generators für useActionState (bewusst ausserhalb der
// "use server"-Datei — dort dürfen nur async Funktionen exportiert werden).

import type { KiModus } from "@/lib/domain";
import type { FormState } from "@/lib/forms";
import type { KiErgebnis, KiParameter } from "./logik";

/** Ein noch nicht gespeicherter Vorschlag aus der Generierung. */
export interface KiVorschlag {
  modus: KiModus;
  titel: string;
  thema: string;
  /** System + User zusammengefasst (wird beim Speichern übernommen). */
  prompt: string;
  parameter: KiParameter;
  ergebnis: KiErgebnis;
  modell: string;
  tokenInput: number | null;
  tokenOutput: number | null;
  dauerMs: number;
  spracheId: string | null;
  niveauId: string | null;
  kursartId: string | null;
}

export interface KiGeneratorState extends FormState {
  vorschlag?: KiVorschlag;
}

export const idleKiGeneratorState: KiGeneratorState = {};
