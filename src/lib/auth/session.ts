// Session-Verwaltung: DB-gestützte Sessions mit httpOnly-Cookie.
// Im Cookie steht nur der Klartext-Token, in der Datenbank nur sein SHA-256-
// Fingerprint. Gültigkeit: absolutes Limit 30 Tage, Idle-Fenster 12 Stunden
// (Verlängerung bei Aktivität bis zum absoluten Limit).

import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, fromDbTime, roleList, toDbTime, type SessionRow, type UserRow } from "@/lib/db";
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
  user: UserRow;
  session: SessionRow;
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

  await db.orm.public.Session.create({
    tokenHash: hashToken(token),
    userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    expiresAt: toDbTime(expiresAt),
  });

  // Abgelaufene Sessions beiläufig entsorgen.
  await db.orm.public.Session.where((s) => s.expiresAt.lt(toDbTime(new Date()))).deleteAll();

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

  const session = await db.orm.public.Session.where({ tokenHash: hashToken(token) })
    .include("user")
    .first();
  if (!session) return null;

  const now = Date.now();
  const expired =
    fromDbTime(session.expiresAt).getTime() < now ||
    fromDbTime(session.lastSeenAt).getTime() + SESSION_IDLE_MS < now ||
    !session.user.isActive;
  if (expired) {
    await db.orm.public.Session.where({ id: session.id }).delete().catch(() => undefined);
    return null;
  }

  if (now - fromDbTime(session.lastSeenAt).getTime() > SESSION_TOUCH_INTERVAL_MS) {
    const newExpires = Math.min(
      now + SESSION_IDLE_MS,
      fromDbTime(session.createdAt).getTime() + SESSION_ABSOLUTE_MS,
    );
    await db.orm.public.Session.where({ id: session.id })
      .update({ lastSeenAt: toDbTime(new Date(now)), expiresAt: toDbTime(new Date(newExpires)) })
      .catch(() => undefined);
  }

  const { user, ...sessionRow } = session;
  return { user, session: sessionRow };
});

/** Wirft die aktuelle Session weg (Logout) und löscht das Cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await db.orm.public.Session.where({ tokenHash: hashToken(token) }).delete().catch(() => undefined);
  }
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

/** Beendet alle Sessions eines Accounts — z.B. nach Passwortwechsel oder durch Admin. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const byUser = db.orm.public.Session.where({ userId });
  const scoped = exceptSessionId ? byUser.where((s) => s.id.neq(exceptSessionId)) : byUser;
  return scoped.deleteAndCount();
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
  const roles = roleList(ctx.user.roles);
  if (roles.every((r) => r === "TEILNEHMER")) {
    redirect(landingRoute(roles));
  }
  return ctx;
}
