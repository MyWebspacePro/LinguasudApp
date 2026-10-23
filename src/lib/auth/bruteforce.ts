// Brute-Force-Schutz: fensterbasierte Auswertung von Auth-Ereignissen.
// Die Entscheidung (`isRateLimited`) ist pur und damit testbar; die DB-Funktionen
// laufen dagegen in Server Actions.

import type { AuthEventKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  AUTH_EVENT_RETENTION_MS,
  LOGIN_MAX_FAILS_EMAIL,
  LOGIN_MAX_FAILS_IP,
  LOGIN_WINDOW_MS,
  RESET_MAX_PER_EMAIL,
  RESET_MAX_PER_IP,
  RESET_WINDOW_MS,
} from "./constants";

export interface RateLimitOptions {
  windowMs: number;
  maxPerEmail: number;
  maxPerIp: number;
}

export function rateLimitOptions(kind: AuthEventKind): RateLimitOptions {
  return kind === "LOGIN"
    ? { windowMs: LOGIN_WINDOW_MS, maxPerEmail: LOGIN_MAX_FAILS_EMAIL, maxPerIp: LOGIN_MAX_FAILS_IP }
    : { windowMs: RESET_WINDOW_MS, maxPerEmail: RESET_MAX_PER_EMAIL, maxPerIp: RESET_MAX_PER_IP };
}

/**
 * Rein funktionale Entscheidung: sperren, wenn im Fenster zu viele Versuche
 * (pro E-Mail oder pro IP) liegen. Die Aufrufer filtern vorher, was zählt —
 * beim Login nur Fehlversuche, bei Reset-Anfragen jede Anfrage.
 */
export function isRateLimited(
  events: { email: string; ip: string | null; createdAt: Date }[],
  email: string,
  ip: string | null,
  options: RateLimitOptions,
  now: Date = new Date(),
): boolean {
  const windowStart = now.getTime() - options.windowMs;
  const inWindow = events.filter((e) => e.createdAt.getTime() >= windowStart);

  const perEmail = inWindow.filter((e) => e.email === email).length;
  const perIp = ip === null ? 0 : inWindow.filter((e) => e.ip === ip).length;

  return perEmail >= options.maxPerEmail || perIp >= options.maxPerIp;
}

// ——— Die DB-Schicht ————————————————————————————————————————————

async function recentEvents(kind: AuthEventKind, email: string, ip: string | null, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const emailFilter: Prisma.LoginAttemptWhereInput = { kind, email, createdAt: { gte: since } };
  const ipFilter: Prisma.LoginAttemptWhereInput =
    ip === null ? {} : { kind, ip, createdAt: { gte: since } };

  return prisma.loginAttempt.findMany({
    where: { OR: [emailFilter, ipFilter] },
    select: { email: true, ip: true, success: true, createdAt: true },
  });
}

/** Prüft die Sperre für einen Login-Versuch (nur Fehlversuche zählen). */
export async function isLoginLocked(email: string, ip: string | null): Promise<boolean> {
  const options = rateLimitOptions("LOGIN");
  const events = await recentEvents("LOGIN", email, ip, options.windowMs);
  return isRateLimited(
    events.filter((e) => !e.success),
    email,
    ip,
    options,
  );
}

/** Prüft die Sperre für eine Reset-Anfrage (jede Anfrage zählt). */
export async function isResetThrottled(email: string, ip: string | null): Promise<boolean> {
  const options = rateLimitOptions("PASSWORD_RESET");
  const events = await recentEvents("PASSWORD_RESET", email, ip, options.windowMs);
  return isRateLimited(events, email, ip, options);
}

export async function recordAuthEvent(input: {
  kind: AuthEventKind;
  email: string;
  ip: string | null;
  success: boolean;
}): Promise<void> {
  await prisma.loginAttempt.create({ data: input });
}

/** Löscht Alt-Ereignisse; wird gelegentlich nebenbei aufgerufen. */
export async function cleanupAuthEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - AUTH_EVENT_RETENTION_MS);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
