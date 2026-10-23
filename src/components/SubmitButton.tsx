"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit-Button mit automatischem Ladezustand (useFormStatus). */
export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Bitte warten …") : children}
    </button>
  );
}
