import "server-only";

// KI-Einstellungen (Modul 14) — Admin pflegt OpenRouter-API-Key und Modell in
// den Stammdaten. Der Key liegt in SystemSetting (nie im Repo, nie im Log);
// nach aussen geben wir nur eine maskierte Fassung aus.

import { db } from "@/lib/db";
import { istKeyGesetzt, maskiereKey } from "./logik";

export const KI_SETTING_KEY = "ki.openrouterApiKey";
export const KI_MODELL_KEY = "ki.modell";

/** Bewusst günstiges Standardmodell (Pflichtenheft: «billiges Modell genügt»). */
export const KI_STANDARD_MODELL = "openai/gpt-4o-mini";

export interface KiEinstellungen {
  apiKey: string | null;
  modell: string;
  aktiv: boolean;
  keyQuelle: "db" | "env" | null;
  modellQuelle: "db" | "env" | "standard";
}

/**
 * Nur für Server-Actions/Service-Code — der Klartext-Key verlässt den Server
 * nicht. DB-Werte haben Vorrang; optional greift ein Env-Fallback.
 */
export async function getKiEinstellungen(): Promise<KiEinstellungen> {
  const [keyRow, modellRow] = await Promise.all([
    db.orm.public.SystemSetting.where({ key: KI_SETTING_KEY }).first(),
    db.orm.public.SystemSetting.where({ key: KI_MODELL_KEY }).first(),
  ]);
  const dbKey = keyRow?.value.trim() || null;
  const envKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  const apiKey = dbKey || envKey;

  const dbModell = modellRow?.value.trim() || null;
  const envModell = process.env.OPENROUTER_MODEL?.trim() || null;
  const modell = dbModell || envModell || KI_STANDARD_MODELL;

  return {
    apiKey,
    modell,
    aktiv: istKeyGesetzt(apiKey),
    keyQuelle: dbKey ? "db" : envKey ? "env" : null,
    modellQuelle: dbModell ? "db" : envModell ? "env" : "standard",
  };
}

/** Sichere Ansicht für die Admin-Oberfläche (Key maskiert). */
export async function getKiEinstellungenMaskiert(): Promise<{
  keyMaskiert: string;
  keyGesetzt: boolean;
  modell: string;
  keyQuelle: "db" | "env" | null;
  modellQuelle: "db" | "env" | "standard";
}> {
  const { apiKey, modell, keyQuelle, modellQuelle } = await getKiEinstellungen();
  return { keyMaskiert: maskiereKey(apiKey), keyGesetzt: istKeyGesetzt(apiKey), modell, keyQuelle, modellQuelle };
}

async function setzeSetting(key: string, value: string): Promise<void> {
  const bestehend = await db.orm.public.SystemSetting.where({ key }).first();
  if (bestehend) {
    await db.orm.public.SystemSetting.where({ key }).update({ value });
  } else {
    await db.orm.public.SystemSetting.create({ key, value });
  }
}

async function loescheSetting(key: string): Promise<void> {
  const bestehend = await db.orm.public.SystemSetting.where({ key }).first();
  if (bestehend) await db.orm.public.SystemSetting.where({ key }).delete();
}

/**
 * Speichert die KI-Einstellungen. `apiKey`:
 * - `undefined` = unverändert lassen
 * - `null` oder leer = Key entfernen (KI deaktivieren)
 * - sonst = neuen Key setzen (getrimmt)
 */
export async function speichereKiEinstellungen(input: {
  apiKey?: string | null;
  modell: string;
}): Promise<void> {
  const modell = input.modell.trim() || KI_STANDARD_MODELL;
  await setzeSetting(KI_MODELL_KEY, modell);

  if (input.apiKey === undefined) return;
  const key = input.apiKey?.trim() ?? "";
  if (!key) {
    await loescheSetting(KI_SETTING_KEY);
    return;
  }
  await setzeSetting(KI_SETTING_KEY, key);
}
