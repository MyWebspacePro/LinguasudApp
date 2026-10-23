import type { FormState } from "@/lib/forms";

/** Fehler-/Erfolgsmeldungen aus Server Actions (FormState) als kompakte Banner. */
export function FormAlert({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <div className="alert-error" role="alert">
        {state.error}
      </div>
    );
  }
  if (state.success) {
    return (
      <div className="alert-success" role="status">
        {state.success}
      </div>
    );
  }
  return null;
}
