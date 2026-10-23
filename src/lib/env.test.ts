import { describe, expect, it } from "vitest";
import { isMailConfigured, parseEnv } from "./env";

const validBase = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("parseEnv", () => {
  it("ergänzt Defaults (APP_ENV, APP_URL, MAIL_FROM)", () => {
    const env = parseEnv(validBase);
    expect(env.APP_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.MAIL_FROM).toContain("Linguasud");
  });

  it("übernimmt gesetzte Werte und wandelt SMTP_PORT in eine Zahl", () => {
    const env = parseEnv({
      ...validBase,
      APP_ENV: "production",
      SMTP_HOST: "smtp.ionos.de",
      SMTP_PORT: "587",
    });
    expect(env.APP_ENV).toBe("production");
    expect(env.SMTP_PORT).toBe(587);
  });

  it("wirft bei ungültiger DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "keine-url" })).toThrow();
  });

  it("wirft bei unbekanntem APP_ENV", () => {
    expect(() => parseEnv({ ...validBase, APP_ENV: "testing" })).toThrow();
  });
});

describe("isMailConfigured", () => {
  it("ist false, wenn ein SMTP-Feld fehlt", () => {
    expect(isMailConfigured({ SMTP_HOST: "smtp.ionos.de", SMTP_USER: "u", SMTP_PASS: undefined })).toBe(false);
    expect(isMailConfigured({ SMTP_HOST: undefined, SMTP_USER: "u", SMTP_PASS: "p" })).toBe(false);
  });

  it("ist true, wenn alle SMTP-Felder gesetzt sind", () => {
    expect(isMailConfigured({ SMTP_HOST: "smtp.ionos.de", SMTP_USER: "u", SMTP_PASS: "p" })).toBe(true);
  });
});
