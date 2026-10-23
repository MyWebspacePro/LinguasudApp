// Server-seitige Passwort-Utilities: bcrypt-Hashing und kryptografische Tokens.
// (Die Policy selbst liegt in password-policy.ts, damit Client-Komponenten sie
// ohne Node-Abhängigkeiten importieren können.)

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Vergleich gegen einen Dummy-Hash, wenn kein Benutzer existiert —
 * verhindert Timing-Angriffe zur Konten-Erkennung (User-Enumeration).
 */
const DUMMY_HASH = "$2b$12$Q0z2tVm1vBsJhSbK3k3xVeF1f6yZ8oG7hL5pQ9wXeR2nT4uY6aB.C";
export async function fakeVerifyPassword(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

/** 256-Bit-Token für Session- bzw. Reset-Cookies/Links (Base64url). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256-Fingerprint; nur dieser landet in der Datenbank. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
