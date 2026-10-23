// Session-Verwaltung: DB-gestützte Sessions mit httpOnly-Cookie.
// Im Cookie steht nur der Klartext-Token, in der Datenbank nur sein SHA-256-
// Fingerprint. Gültigkeit: absoltes Limit 30 Tage, Idle-Fenster 12 Stunden
// (Verlängerung bei Aktivität bis zum absoluten Limit).

import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, Session, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { RequestMeta } from "@/lib/request";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from "./constants";
import { generateToken, hashToken } from "./password";
import { landingRoute } from "./permissions";

export interface AuthContext {
  user: User;
  session: Session;
}

function cookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.APP_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  };
}

/** Legt eine neue Session an und setzt das Cookie (nur in Actions/Route Handlern). */
export async function createSession(userId: string, meta: RequestMeta): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
    },
  });

  // Abgelaufene Sessions beiläufig entsorgen.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  (await cookies()).set(SESSION_COOKIE_NAME, token, cookieOptions());
}

/**
 * Liest die aktuelle Session (pro Request gecached). Prüft Cookie, Session-
 * Gültigkeit (absolut + Idle) und ob der Account noch aktiv ist. Verlängert
 * das Idle-Fenster bei Bedarf.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  const now = Date.now();
  const expired =
    session.expiresAt.getTime() < now ||
    session.lastSeenAt.getTime() + SESSION_IDLE_MS < now ||
    !session.user.isActive;
  if (expired) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(now),
          expiresAt: new Date(
            Math.min(now + SESSION_IDLE_MS, session.createdAt.getTime() + SESSION_ABSOLUTE_MS),
          ),
        },
      })
      .catch(() => undefined);
  }

  return { user: session.user, session };
});

/** Wirft die aktuelle Session weg (Logout) und löscht das Cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.delete({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

/** Beendet alle Sessions eines Accounts — z.B. nach Passwortwechsel oder durch Admin. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return result.count;
}

// ——— Wächter für Seiten —————————————————————————————————————————

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }
  if (ctx.user.mustChangePassword) {
    redirect("/passwort-aendern");
  }
  return ctx;
}

/** Verwaltungsbereich: nur Stabsrollen (alles ausser reinen Teilnehmenden). */
export async function requireStaff(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.user.roles.every((r) => r === "TEILNEHMER")) {
    redirect(landingRoute(ctx.user.roles as Role[]));
  }
  return ctx;
}
