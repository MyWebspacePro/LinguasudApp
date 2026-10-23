// Passwort-Politik nach Pflichtenheft: min. 20 Zeichen, Gross-/Kleinbuchstaben,
// Zahlen und Sonderzeichen. Diese Datei ist bewusst frei von Node-APIs, damit
// Client-Komponenten (Passwort-Feedback, Generator) sie importieren können.

import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 20;

const RULES: { test: (pw: string) => boolean; error: string }[] = [
  {
    test: (pw) => pw.length >= PASSWORD_MIN_LENGTH,
    error: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
  },
  { test: (pw) => /[a-z]/.test(pw), error: "Mindestens ein Kleinbuchstabe" },
  { test: (pw) => /[A-Z]/.test(pw), error: "Mindestens ein Grossbuchstabe" },
  { test: (pw) => /[0-9]/.test(pw), error: "Mindestens eine Ziffer" },
  { test: (pw) => /[^A-Za-z0-9]/.test(pw), error: "Mindestens ein Sonderzeichen" },
];

/** Alle verletzten Regeln (leer = Passwort entspricht der Politik). */
export function passwordPolicyErrors(password: string): string[] {
  return RULES.filter((rule) => !rule.test(password)).map((rule) => rule.error);
}

/** Zod-Schema für serverseitige Validierung (sammelt alle Verstösse). */
export const passwordSchema = z.string().superRefine((pw, ctx) => {
  for (const error of passwordPolicyErrors(pw)) {
    ctx.addIssue({ code: "custom", message: error });
  }
});

// Ohne leicht verwechselbare Zeichen (l, I, 1, O, 0 …).
const CHAR_CLASSES = [
  "abcdefghijkmnopqrstuvwxyz",
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "23456789",
  "!@#$%^&*-_=+?",
];

/** Erzeugt ein Regel-konformes Zufallspasswort (für die Erstvergabe durch Admin/Büro). */
export function generatePassword(length = 24): string {
  const all = CHAR_CLASSES.join("");
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // Pro Klasse ein sicheres Zeichen garantiert …
  const chars = CHAR_CLASSES.map(pick);
  while (chars.length < length) {
    chars.push(pick(all));
  }
  // … dann mischen (Fisher-Yates).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
