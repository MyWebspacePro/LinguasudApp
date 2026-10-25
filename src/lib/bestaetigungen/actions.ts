"use server";

// Kursbestätigungs-Server-Actions (Modul 10): manuelle Erzeugung durchs
// Büro (Admin/Chef/Büro — canManageKurse) für einen Niveau-Abschnitt,
// jederzeit möglich (auch laufender Abschnitt: Zeitraum bis heute, und
// beendete Anmeldungen). Erneutes Erzeugen aktualisiert die Snapshots.
// Löschen einzelner Bestätigungen ebenfalls durchs Büro. Alles Audit.

import { revalidatePath } from "next/cache";
import { db, roleList } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageKurse } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { erzeugeBestaetigungenFuerAbschnitt } from "./erstellung";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireBestaetigungsManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageKurse(roleList(ctx.user.roles))) {
    return { failure: { error: "Das Erzeugen von Kursbestätigungen ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

/** Bestätigungen für einen Niveau-Abschnitt erzeugen/aktualisieren (Büro). */
export async function erzeugeBestaetigungenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBestaetigungsManager();
  if ("failure" in guard) return guard.failure;

  const verlaufId = str(formData, "verlaufId");
  if (!verlaufId) return { error: "Niveau-Abschnitt fehlt." };

  try {
    const ergebnis = await erzeugeBestaetigungenFuerAbschnitt({
      verlaufId,
      ausloeser: "MANUELL",
      actor: guard.actor,
    });
    if (ergebnis.personen.length === 0) {
      return { error: "Keine (aktiv oder beendet) angemeldeten Teilnehmenden für diesen Kurs." };
    }
    revalidatePath(`/kurse/${ergebnis.kursId}`);
    revalidatePath("/portal");
    return {
      success:
        `Bestätigungen Niveau ${ergebnis.niveauCode} (${ergebnis.vonKey} bis ${ergebnis.bisKey}) ` +
        `erzeugt: ${ergebnis.erstellt} neu, ${ergebnis.aktualisiert} aktualisiert ` +
        `(${ergebnis.personen.join(", ")}).`,
    };
  } catch (error) {
    console.error("Kursbestätigungen erzeugen fehlgeschlagen:", error);
    return { error: error instanceof Error ? error.message : "Kursbestätigungen konnten nicht erzeugt werden." };
  }
}

/** Einzelne Bestätigung löschen (Büro) — z.B. versehentlich erzeugt. */
export async function loescheBestaetigungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireBestaetigungsManager();
  if ("failure" in guard) return guard.failure;

  const bestaetigungId = str(formData, "bestaetigungId");
  const bestaetigung = await db.orm.public.Kursbestaetigung.where({ id: bestaetigungId }).first();
  if (!bestaetigung) return { error: "Bestätigung nicht gefunden." };

  await db.orm.public.Kursbestaetigung.where({ id: bestaetigungId }).delete();
  await recordAudit({
    actor: guard.actor,
    action: "bestaetigung.geloescht",
    entity: "kursbestaetigung",
    entityId: bestaetigungId,
    summary:
      `Kursbestätigung Niveau ${bestaetigung.niveauCode} für ${bestaetigung.personName} ` +
      `(Kurs «${bestaetigung.kursCode}») gelöscht`,
  });
  revalidatePath(`/kurse/${bestaetigung.kursId}`);
  revalidatePath("/portal");
  return { success: `Bestätigung für ${bestaetigung.personName} gelöscht.` };
}
