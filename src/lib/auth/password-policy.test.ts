import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  generatePassword,
  passwordPolicyErrors,
  passwordSchema,
} from "./password-policy";

describe("passwordPolicyErrors", () => {
  it("akzeptiert ein Regel-konformes Passwort", () => {
    expect(passwordPolicyErrors("Sicheres!Passwort2026fuer-Linguasud")).toEqual([]);
  });

  it("meldet alle fehlenden Klassen", () => {
    const errors = passwordPolicyErrors("kurz");
    expect(errors).toContain(`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`);
    expect(errors).toContain("Mindestens ein Grossbuchstabe");
    expect(errors).toContain("Mindestens eine Ziffer");
    expect(errors).toContain("Mindestens ein Sonderzeichen");
    expect(errors).not.toContain("Mindestens ein Kleinbuchstabe");
  });

  it("meldet fehlenden Kleinbuchstaben", () => {
    expect(passwordPolicyErrors("NUR-GROSSBUCHSTABEN-2026-XY!")).toContain(
      "Mindestens ein Kleinbuchstabe",
    );
  });

  it("kennt die 20-Zeichen-Grenze", () => {
    // 19 Zeichen, sonst regelkonform
    const pw = "Ab1!" + "a".repeat(15); // 4 + 15 = 19
    expect(passwordPolicyErrors(pw)).toEqual([`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`]);
    const ok = "Ab1!" + "a".repeat(16); // 20
    expect(passwordPolicyErrors(ok)).toEqual([]);
  });
});

describe("passwordSchema", () => {
  it("ist gültig bei konformem Passwort und sammelt sonst alle Issues", () => {
    expect(passwordSchema.safeParse("Gutes!Passwort-2026-mit-20-Zeichen").success).toBe(true);
    const result = passwordSchema.safeParse("schwach");
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(4);
  });
});

describe("generatePassword", () => {
  it("erzeugt Passwörter, die die Politik erfüllen", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(passwordPolicyErrors(pw)).toEqual([]);
      expect(pw.length).toBe(24);
    }
  });
});
