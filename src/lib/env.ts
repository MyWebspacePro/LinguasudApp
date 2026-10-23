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
