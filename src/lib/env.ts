import { z } from "zod";

/**
 * Umgebungsvariablen der Applikation.
 * `parseEnv` wird zur Laufzeit aufgerufen (nicht beim Build) und darf bei
 * fehlerhafter Konfiguration bewusst abbrechen — Produktiv darf nie mit
 * halber Konfiguration laufen.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_ENV: z.enum(["development", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // E-Mail (IONOS SMTP) — erst ab Modul 1 verpflichtend
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Linguasud Verwaltung <noreply@aiconso.eu>"),
  // Schweizer QR-Rechnung (Modul 9): QR-IBAN (QR-IID 30000–31999) und
  // Schulinstitution als Zahlungsempfänger. Ohne Konfiguration keine
  // QR-Zahlteile (Fehler mit Hinweis auf .env.example).
  QR_RECHNUNG_QR_IBAN: z.string().optional(),
  QR_RECHNUNG_NAME: z.string().optional(),
  QR_RECHNUNG_STRASSE: z.string().optional(),
  QR_RECHNUNG_PLZ: z.string().optional(),
  QR_RECHNUNG_ORT: z.string().optional(),
  QR_RECHNUNG_LAND: z.string().default("CH"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

/** Laufzeit-Zugriff auf die validierte Umgebung (wirft bei Fehlkonfiguration). */
export function getEnv(): Env {
  return parseEnv(process.env);
}

/** Prüft, ob der E-Mail-Versand vollständig konfiguriert ist. */
export function isMailConfigured(env: Pick<Env, "SMTP_HOST" | "SMTP_USER" | "SMTP_PASS">): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

/**
 * QR-Rechnung ist konfiguriert, sobald QR-IBAN und alle Adressfelder der
 * Schulinstitution gesetzt sind (Dummy-Werte für lokale Tests genügen).
 */
export function isQrRechnungConfigured(
  env: Pick<Env, "QR_RECHNUNG_QR_IBAN" | "QR_RECHNUNG_NAME" | "QR_RECHNUNG_STRASSE" | "QR_RECHNUNG_PLZ" | "QR_RECHNUNG_ORT">,
): boolean {
  return Boolean(
    env.QR_RECHNUNG_QR_IBAN && env.QR_RECHNUNG_NAME && env.QR_RECHNUNG_STRASSE && env.QR_RECHNUNG_PLZ && env.QR_RECHNUNG_ORT,
  );
}
