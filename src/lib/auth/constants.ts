// Geteilte Auth-Konstanten — bewusst frei von Server-Abhängigkeiten,
// damit auch proxy.ts (Edge) sie importieren kann.

/** Name des Session-Cookies (httpOnly). */
export const SESSION_COOKIE_NAME = "linguasud_session";

/** Idle-Fenster: ohne Aktivität verfällt die Session nach 12 Stunden. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

/** Absolute Höchstlaufzeit einer Session (auch bei laufender Aktivität). */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

/** lastSeenAt wird höchstens einmal pro Stunde aktualisiert (DB-Last sparen). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/** Brute-Force-Schutz Login: max. Fehlversuche pro E-Mail innerhalb des Fensters. */
export const LOGIN_MAX_FAILS_EMAIL = 5;

/** Brute-Force-Schutz Login: max. Fehlversuche pro IP innerhalb des Fensters. */
export const LOGIN_MAX_FAILS_IP = 20;

/** Auswertungsfenster für Login-Fehlversuche (15 Minuten). */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Passwort-Reset anfordern: max. Anfragen pro E-Mail / IP pro Stunde. */
export const RESET_MAX_PER_EMAIL = 3;
export const RESET_MAX_PER_IP = 10;
export const RESET_WINDOW_MS = 60 * 60 * 1000;

/** Gültigkeit eines Passwort-Reset-/Einladungslinks. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Alte Auth-Ereignisse werden opportunistisch aufgeräumt. */
export const AUTH_EVENT_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Geschützte Präfixe (optimistische Prüfung in proxy.ts). */
export const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/benutzer",
  "/personen",
  "/audit",
  "/portal",
  "/passwort-aendern",
  "/website",
] as const;
