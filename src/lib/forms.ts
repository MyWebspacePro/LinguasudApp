// Geteilter Formular-Zustand für Server Actions + useActionState.
// (Bewusst ausserhalb der "use server"-Dateien: dort dürfen nur async
// Funktionen exportiert werden.)

export interface FormState {
  error?: string;
  success?: string;
  /** Feldname → Fehlermeldung (je Feld eine Zeile). */
  fieldErrors?: Record<string, string>;
}

export const idleFormState: FormState = {};
