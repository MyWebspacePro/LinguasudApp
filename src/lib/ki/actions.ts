"use server";

// KI-Lektionsgenerator (Modul 14, Server-Actions):
// - Generieren: Eingaben prüfen, OpenRouter aufrufen, Ergebnis validieren und
//   als Vorschlag an das Formular zurückgeben (noch nicht gespeichert).
// - Speichern: validierten Vorschlag in der Bibliothek ablegen.
// - Teilen/Löschen: eigene Lektionen (Admin/Chef zusätzlich fremde).
// - Admin-Einstellungen: OpenRouter-Key + Modell (nur Admin, Key maskiert).
// Alle Vorgänge landen im Audit-Log (ki.*).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, roleList, type Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canAdminKi, canManageKiEinstellungen, canViewKi } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import type { FormState } from "@/lib/forms";
import type { Models } from "@/prisma/contract.d";
import { getKiEinstellungen, speichereKiEinstellungen } from "./einstellungen";
import { frageOpenRouter, OpenRouterFehler } from "./openrouter";
import {
  bauePrompt,
  baueTitel,
  istRohtext,
  parseKiErgebnis,
  promptAlsText,
  pruefeParameter,
  themaAuszug,
  type KiParameter,
  type KiParameterFrei,
  type KiParameterStruktur,
} from "./logik";
import type { KiGeneratorState } from "./state";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const zeilen = (fd: FormData, key: string) =>
  str(fd, key)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const zahlOderNull = (wert: string): number | null => {
  if (!wert) return null;
  const n = Number.parseInt(wert, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function revalidateKi(...pfade: string[]) {
  revalidatePath("/ki-generator");
  revalidatePath("/ki-generator/bibliothek");
  revalidatePath("/dashboard");
  for (const p of pfade) revalidatePath(p);
}

interface KiAkteur {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

async function requireKiAkteur(): Promise<{ akteur: KiAkteur } | { failure: FormState }> {
  const { user } = await requireStaff();
  const roles = roleList(user.roles) as Role[];
  if (!canViewKi(roles)) {
    return { failure: { error: "Kein Zugriff auf den KI-Lektor." } };
  }
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  return { akteur: { id: user.id, email: user.email, name, roles } };
}

// ——— Generieren ————————————————————————————————————————————————————

export async function generiereKiLektionAction(
  _prev: KiGeneratorState,
  formData: FormData,
): Promise<KiGeneratorState> {
  const guard = await requireKiAkteur();
  if ("failure" in guard) return guard.failure;
  const { akteur } = guard;

  const modus = str(formData, "modus") === "FREI" ? "FREI" : "STRUKTUR";
  let parameter: KiParameter;
  let spracheId: string | null = null;
  let niveauId: string | null = null;
  let kursartId: string | null = null;

  if (modus === "FREI") {
    parameter = { prompt: str(formData, "prompt") } satisfies KiParameterFrei;
  } else {
    spracheId = str(formData, "spracheId") || null;
    niveauId = str(formData, "niveauId") || null;
    kursartId = str(formData, "kursartId") || null;

    if (!spracheId) return { error: "Bitte eine Sprache wählen.", fieldErrors: { spracheId: "Pflichtfeld" } };
    if (!niveauId) return { error: "Bitte ein Niveau wählen.", fieldErrors: { niveauId: "Pflichtfeld" } };

    const [sprache, niveau, kursart] = await Promise.all([
      db.orm.public.Sprache.where({ id: spracheId }).first(),
      db.orm.public.Niveau.where({ id: niveauId }).first(),
      kursartId ? db.orm.public.Kursart.where({ id: kursartId }).first() : Promise.resolve(null),
    ]);
    if (!sprache) return { error: "Die gewählte Sprache existiert nicht (mehr).", fieldErrors: { spracheId: "Ungültig" } };
    if (!niveau) return { error: "Das gewählte Niveau existiert nicht (mehr).", fieldErrors: { niveauId: "Ungültig" } };
    if (kursartId && !kursart) return { error: "Die gewählte Kursart existiert nicht (mehr).", fieldErrors: { kursartId: "Ungültig" } };

    parameter = {
      sprache: sprache.name,
      niveau: niveau.code,
      kursart: kursart?.name ?? null,
      dauerMinuten: Number.parseInt(str(formData, "dauerMinuten"), 10),
      lernziele: zeilen(formData, "lernziele"),
      zusatzhinweise: str(formData, "zusatzhinweise") || null,
    } satisfies KiParameterStruktur;
  }

  const fehler = pruefeParameter(modus, parameter);
  if (Object.keys(fehler).length > 0) {
    return { error: "Bitte die markierten Felder prüfen.", fieldErrors: fehler };
  }

  const einstellungen = await getKiEinstellungen();
  if (!einstellungen.aktiv || !einstellungen.apiKey) {
    return {
      error:
        "Die KI ist noch nicht konfiguriert. Admin: Stammdaten → KI-Lektor (OpenRouter-Key und Modell hinterlegen).",
    };
  }

  const prompt = bauePrompt(modus, parameter);
  const start = Date.now();
  try {
    const antwort = await frageOpenRouter(prompt, {
      apiKey: einstellungen.apiKey,
      modell: einstellungen.modell,
    });
    const dauerMs = Date.now() - start;
    const ergebnis = parseKiErgebnis(antwort.content, modus);
    const rohFallback = istRohtext(ergebnis);
    const titel = baueTitel(modus, parameter);
    const thema = themaAuszug(modus, parameter);

    await recordAudit({
      actor: { id: akteur.id, email: akteur.email },
      action: "ki.lektion.generieren",
      entity: "ki_lektion",
      summary: `KI-Lektion generiert: ${titel}`,
      details: {
        modus,
        modell: antwort.modell,
        dauerMs,
        tokenInput: antwort.tokenInput,
        tokenOutput: antwort.tokenOutput,
      },
      request: await getRequestMeta(),
    });

    return {
      success: rohFallback
        ? "Vorschlag generiert, aber die KI-Antwort war nicht strukturiert — der Rohtext wird angezeigt. Bitte prüfen und speichern."
        : "Vorschlag generiert — prüfen, bei Bedarf erneut generieren und speichern.",
      vorschlag: {
        modus,
        titel,
        thema,
        prompt: promptAlsText(prompt),
        parameter,
        ergebnis,
        modell: antwort.modell,
        tokenInput: antwort.tokenInput,
        tokenOutput: antwort.tokenOutput,
        dauerMs,
        spracheId,
        niveauId,
        kursartId,
      },
    };
  } catch (error) {
    if (error instanceof OpenRouterFehler) return { error: error.message };
    console.error("KI-Generierung fehlgeschlagen:", error);
    return { error: "Die Generierung ist fehlgeschlagen. Bitte erneut versuchen." };
  }
}

// ——— Speichern ————————————————————————————————————————————————————

export async function speichereKiLektionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKiAkteur();
  if ("failure" in guard) return guard.failure;
  const { akteur } = guard;

  const modus = str(formData, "modus") === "FREI" ? "FREI" : "STRUKTUR";
  const titel = str(formData, "titel");
  const thema = str(formData, "thema") || null;
  const prompt = str(formData, "prompt");
  const parameterRaw = str(formData, "parameter");
  const ergebnisRaw = str(formData, "ergebnis");

  if (titel.length < 3) return { error: "Titel fehlt.", fieldErrors: { titel: "Mindestens 3 Zeichen" } };
  if (titel.length > 200) return { error: "Titel ist zu lang.", fieldErrors: { titel: "Maximal 200 Zeichen" } };
  if (prompt.length < 10) return { error: "Prompt fehlt.", fieldErrors: { prompt: "Der Prompt ist unvollständig." } };
  if (prompt.length > 20_000) return { error: "Prompt ist zu lang.", fieldErrors: { prompt: "Maximal 20 000 Zeichen" } };
  if (!ergebnisRaw) return { error: "Kein Ergebnis zum Speichern vorhanden." };

  let parameter: KiParameter;
  try {
    const parsed = JSON.parse(parameterRaw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "Die Parameter sind ungültig." };
    }
    parameter = parsed as KiParameter;
  } catch {
    return { error: "Die Parameter sind ungültig." };
  }

  const fehler = pruefeParameter(modus, parameter);
  if (Object.keys(fehler).length > 0) return { error: "Die Parameter sind ungültig.", fieldErrors: fehler };

  let ergebnis;
  try {
    ergebnis = parseKiErgebnis(ergebnisRaw, modus);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Das Ergebnis ist ungültig." };
  }

  const spracheId = str(formData, "spracheId") || null;
  const niveauId = str(formData, "niveauId") || null;
  const kursartId = str(formData, "kursartId") || null;

  if (modus === "STRUKTUR") {
    if (!spracheId || !niveauId) return { error: "Sprache und Niveau fehlen." };
  }

  const modell = str(formData, "modell").slice(0, 200) || null;
  const tokenInput = zahlOderNull(str(formData, "tokenInput"));
  const tokenOutput = zahlOderNull(str(formData, "tokenOutput"));
  const dauerMs = zahlOderNull(str(formData, "dauerMs"));

  try {
    const row = await db.orm.public.KiLektion.create({
      titel,
      modus,
      thema,
      prompt,
      // JSONB-Felder: der Prisma-8-Contract typisiert sie als JsonValue; unsere
      // validierten Strukturen sind JSON-kompatibel, daher bewusster Cast.
      parameter: parameter as unknown as Models.public_KiLektion["parameter"],
      ergebnis: ergebnis as unknown as Models.public_KiLektion["ergebnis"],
      modell,
      tokenInput,
      tokenOutput,
      dauerMs,
      geteilt: false,
      erstelltVonUserId: akteur.id,
      erstelltVonName: akteur.name,
      spracheId: modus === "STRUKTUR" ? spracheId : null,
      niveauId: modus === "STRUKTUR" ? niveauId : null,
      kursartId: modus === "STRUKTUR" ? kursartId : null,
    });

    await recordAudit({
      actor: { id: akteur.id, email: akteur.email },
      action: "ki.lektion.erstellen",
      entity: "ki_lektion",
      entityId: row.id,
      summary: `KI-Lektion gespeichert: ${titel}`,
      details: { modus, modell },
      request: await getRequestMeta(),
    });

    revalidateKi("/ki-generator/bibliothek");
    redirect(`/ki-generator/${row.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error; // NEXT_REDIRECT
    console.error("KI-Lektion speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
}

// ——— Teilen / Löschen ——————————————————————————————————————————————

export async function teileKiLektionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKiAkteur();
  if ("failure" in guard) return guard.failure;
  const { akteur } = guard;

  const id = str(formData, "id");
  const geteilt = str(formData, "geteilt") === "true";
  if (!id) return { error: "Lektion fehlt." };

  const row = await db.orm.public.KiLektion.where({ id }).first();
  if (!row) return { error: "Lektion nicht gefunden." };
  const darf = row.erstelltVonUserId === akteur.id || canAdminKi(akteur.roles);
  if (!darf) return { error: "Keine Berechtigung für diese Lektion." };

  try {
    await db.orm.public.KiLektion.where({ id }).update({ geteilt });
    await recordAudit({
      actor: { id: akteur.id, email: akteur.email },
      action: "ki.lektion.teilen",
      entity: "ki_lektion",
      entityId: id,
      summary: `KI-Lektion «${row.titel}» ${geteilt ? "geteilt" : "nicht mehr geteilt"}`,
      details: { geteilt },
    });
    revalidateKi(`/ki-generator/${id}`, "/ki-generator/bibliothek");
    return { success: geteilt ? "Lektion für das Kollegium freigegeben." : "Freigabe entfernt." };
  } catch (error) {
    console.error("KI-Lektion teilen fehlgeschlagen:", error);
    return { error: "Änderung fehlgeschlagen." };
  }
}

export async function loescheKiLektionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKiAkteur();
  if ("failure" in guard) return guard.failure;
  const { akteur } = guard;

  const id = str(formData, "id");
  if (!id) return { error: "Lektion fehlt." };

  const row = await db.orm.public.KiLektion.where({ id }).first();
  if (!row) return { error: "Lektion nicht gefunden." };
  const darf = row.erstelltVonUserId === akteur.id || canAdminKi(akteur.roles);
  if (!darf) return { error: "Keine Berechtigung für diese Lektion." };

  try {
    await db.orm.public.KiLektion.where({ id }).delete();
    await recordAudit({
      actor: { id: akteur.id, email: akteur.email },
      action: "ki.lektion.loeschen",
      entity: "ki_lektion",
      entityId: id,
      summary: `KI-Lektion «${row.titel}» gelöscht`,
      details: { modus: row.modus },
    });
    revalidateKi("/ki-generator/bibliothek");
    redirect("/ki-generator/bibliothek");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("KI-Lektion löschen fehlgeschlagen:", error);
    return { error: "Löschen fehlgeschlagen." };
  }
}

// ——— Admin-Einstellungen ——————————————————————————————————————————

export async function speichereKiEinstellungenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireStaff();
  const roles = roleList(user.roles) as Role[];
  if (!canManageKiEinstellungen(roles)) {
    return { error: "KI-Einstellungen darf nur der Admin pflegen." };
  }

  const modell = str(formData, "modell");
  if (!modell) return { error: "Bitte ein Modell angeben.", fieldErrors: { modell: "Pflichtfeld" } };
  if (modell.length > 200) return { error: "Modellname ist zu lang.", fieldErrors: { modell: "Maximal 200 Zeichen" } };

  const keyFeld = str(formData, "apiKey");
  const keyEntfernen = formData.get("keyEntfernen") === "on";
  const apiKey: string | null | undefined = keyEntfernen ? null : keyFeld || undefined;

  try {
    await speichereKiEinstellungen({ apiKey, modell });
    await recordAudit({
      actor: { id: user.id, email: user.email },
      action: "ki.einstellungen.aktualisieren",
      entity: "system_setting",
      summary: "KI-Einstellungen aktualisiert",
      details: { modell, keyEntfernt: keyEntfernen, keyNeuGesetzt: Boolean(keyFeld) && !keyEntfernen },
      request: await getRequestMeta(),
    });
    revalidatePath("/stammdaten");
    revalidatePath("/stammdaten/ki-generator");
    revalidatePath("/ki-generator");
    return { success: "KI-Einstellungen gespeichert." };
  } catch (error) {
    console.error("KI-Einstellungen speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}
