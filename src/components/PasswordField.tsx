"use client";

import { useId, useState } from "react";
import { PASSWORD_MIN_LENGTH, passwordPolicyErrors } from "@/lib/auth/password-policy";

/**
 * Passwort-Feld mit Anzeige-Wechsel und optionaler Live-Checkliste der
 * Passwort-Politik (min. 20 Zeichen, Gross/Klein, Zahl, Sonderzeichen).
 */
export function PasswordField({
  name,
  label,
  autoComplete = "new-password",
  showPolicy = false,
  error,
  value,
  onChange,
  required = true,
}: {
  name: string;
  label: string;
  autoComplete?: string;
  showPolicy?: boolean;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [internal, setInternal] = useState("");
  const id = useId();
  const current = value ?? internal;
  const policy = showPolicy ? passwordPolicyErrors(current) : [];
  const satisfied = showPolicy ? current.length > 0 && policy.length === 0 : null;

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          className="input pr-16"
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={
            onChange ? (e) => onChange(e.target.value) : (e) => setInternal(e.target.value)
          }
        />
        <button
          type="button"
          className="absolute inset-y-0 right-2 cursor-pointer text-xs font-medium text-slate-600 hover:text-brand-700"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Verbergen" : "Anzeigen"}
        </button>
      </div>

      {showPolicy && (
        <ul
          aria-hidden={current.length === 0}
          className="mt-1.5 space-y-0.5 text-xs text-slate-600"
        >
          <PolicyRow ok={current.length >= PASSWORD_MIN_LENGTH}>
            Mindestens {PASSWORD_MIN_LENGTH} Zeichen
          </PolicyRow>
          <PolicyRow ok={/[a-z]/.test(current)}>Kleinbuchstaben</PolicyRow>
          <PolicyRow ok={/[A-Z]/.test(current)}>Grossbuchstaben</PolicyRow>
          <PolicyRow ok={/[0-9]/.test(current)}>Ziffer</PolicyRow>
          <PolicyRow ok={/[^A-Za-z0-9]/.test(current)}>Sonderzeichen</PolicyRow>
        </ul>
      )}
      {satisfied === true && (
        <p className="mt-1 text-xs text-emerald-700">Passwort erfüllt alle Anforderungen.</p>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function PolicyRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "text-emerald-700" : ""}>
      <span aria-hidden className="mr-1 inline-block w-3.5 text-center">
        {ok ? "✓" : "•"}
      </span>
      {children}
    </li>
  );
}
