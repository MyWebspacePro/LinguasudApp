"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Submit-Button mit automatischem Ladezustand (useFormStatus). */
export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  title,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} title={title}>
      {pending ? (pendingText ?? "Bitte warten …") : children}
    </button>
  );
}
