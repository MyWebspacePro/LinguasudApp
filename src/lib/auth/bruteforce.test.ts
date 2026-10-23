import { describe, expect, it } from "vitest";
import { isRateLimited, rateLimitOptions } from "./bruteforce";

const WINDOW = 15 * 60 * 1000;
const now = new Date("2026-10-23T12:00:00Z");

function at(offsetMs: number): Date {
  return new Date(now.getTime() + offsetMs);
}

const loginOptions = { windowMs: WINDOW, maxPerEmail: 5, maxPerIp: 20 };
const resetOptions = rateLimitOptions("PASSWORD_RESET");

describe("isRateLimited", () => {
  it("sperrt ab 5 Fehlversuchen für dieselbe E-Mail im Fenster", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      email: "a@b.ch",
      ip: `10.0.0.${i}`,
      createdAt: at(-i * 60_000),
    }));
    expect(isRateLimited(events, "a@b.ch", null, loginOptions, now)).toBe(true);
  });

  it("4 Fehlversuche sperren noch nicht", () => {
    const events = Array.from({ length: 4 }, (_, i) => ({
      email: "a@b.ch",
      ip: `10.0.0.${i}`,
      createdAt: at(-i * 60_000),
    }));
    expect(isRateLimited(events, "a@b.ch", null, loginOptions, now)).toBe(false);
  });

  it("Fehlversuche ausserhalb des Fensters zählen nicht mehr", () => {
    const events = [
      ...Array.from({ length: 4 }, (_, i) => ({
        email: "a@b.ch",
        ip: "10.0.0.1",
        createdAt: at(-14 * 60_000 - i * 1000),
      })),
      { email: "a@b.ch", ip: "10.0.0.1", createdAt: at(-16 * 60_000) },
    ];
    expect(isRateLimited(events, "a@b.ch", null, loginOptions, now)).toBe(false);
  });

  it("sperrt ab 20 Fehlversuchen pro IP (über verschiedene E-Mails)", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      email: `user${i}@b.ch`,
      ip: "10.0.0.9",
      createdAt: at(-i * 1000),
    }));
    expect(isRateLimited(events, "opfer@b.ch", "10.0.0.9", loginOptions, now)).toBe(true);
    expect(isRateLimited(events, "opfer@b.ch", "10.0.0.8", loginOptions, now)).toBe(false);
  });

  it("ohne IP zählt nur die E-Mail", () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      email: "andere@b.ch",
      ip: "10.0.0.9",
      createdAt: at(-i * 1000),
    }));
    expect(isRateLimited(events, "a@b.ch", null, loginOptions, now)).toBe(false);
  });

  it("Reset-Anfragen: 3 pro E-Mail/Stunde (jede Anfrage zählt)", () => {
    expect(resetOptions).toEqual({ windowMs: 60 * 60 * 1000, maxPerEmail: 3, maxPerIp: 10 });
    const events = Array.from({ length: 3 }, (_, i) => ({
      email: "a@b.ch",
      ip: "10.0.0.1",
      createdAt: at(-i * 60_000),
    }));
    expect(isRateLimited(events, "a@b.ch", "10.0.0.1", resetOptions, now)).toBe(true);
  });
});
