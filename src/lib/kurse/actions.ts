"use server";

// Kurs-Server-Actions (Modul 4): fortlaufende Kurse ohne Start-/Enddatum,
// automatischer Kurscode (DE-B2-6ER-SMIT01-01), Niveau-Verlauf mit
// Zeiträumen, Unterbrechungen (Planer: ausgegraut + überbuchbar), Firmenkurse
// extern. Pflegen dürfen Admin/Chef/Büro; Lehrpersonen melden Unterbrechungen
// und Niveau-Wechsel für ihre eigenen Kurse. Alles über den Audit-Log.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isForeignKeyViolation, isUniqueViolation, toDbTime, type Role } from "@/lib/db";
import { KURS_STATUS_WERTE, type KursStatus } from "@/lib/domain";
import { getAuthContext } from "@/lib/auth/session";
import { canManageKurse, canViewKurse, hasRole } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { normalizeTimeInput } from "@/lib/stammdaten/tarif";
import { addDays, dateKeyToUtcMidnight, heuteDateKey, parseDateKey } from "@/lib/zeit";
import { zerlegeKursCode } from "./kurscode";
import { naechsterKursCode } from "./kurscode-server";
import { erzeugeBestaetigungenFuerAbschnitt } from "@/lib/bestaetigungen/erstellung";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** UTC-Mitternacht eines Kalendertags als DB-Zeit (Konvention für reine Datumsfelder). */
function dbDatum(dateKey: string): string {
  return toDbTime(dateKeyToUtcMidnight(dateKey));
}

interface ActionUser {
  id: string;
  email: string;
  name: string;
  personId: string | null;
  rollen: Role[];
}

async function requireKursManager(): Promise<{ actor: ActionUser } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = roleListOf(ctx);
  if (!canManageKurse(rollen)) {
    return { failure: { error: "Die Kursverwaltung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: actorOf(ctx, rollen) };
}

/**
 * Wächter für Melde-Aktionen (Niveau-Wechsel, Unterbrechung): das Büro darf
 * überall, Lehrpersonen nur in ihren eigenen Kursen (Pflichtenheft Modul 4).
 */
async function requireKursZugriff(
  kursId: string,
): Promise<{ actor: ActionUser; alsLehrperson: boolean } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = roleListOf(ctx);
  if (!canViewKurse(rollen)) {
    return { failure: { error: "Kein Zugriff auf die Kursdaten." } };
  }
  const actor = actorOf(ctx, rollen);
  if (canManageKurse(rollen)) {
    return { actor, alsLehrperson: false };
  }
  if (!hasRole(rollen, "LEHRPERSON") || !actor.personId) {
    return { failure: { error: "Nur das Büro oder die Lehrperson des Kurses kann melden." } };
  }
  const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
  if (!kurs) return { failure: { error: "Kurs nicht gefunden." } };
  if (kurs.lehrpersonId !== actor.personId) {
    return { failure: { error: "Sie können nur Kurse melden, die Sie selbst unterrichten." } };
  }
  return { actor, alsLehrperson: true };
}

function roleListOf(ctx: { user: { roles: unknown } }): Role[] {
  return ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
}

function actorOf(ctx: { user: { id: string; email: string; firstName: string; lastName: string; personId: string | null } }, rollen: Role[]): ActionUser {
  return {
    id: ctx.user.id,
    email: ctx.user.email,
    name: `${ctx.user.firstName} ${ctx.user.lastName}`,
    personId: ctx.user.personId,
    rollen,
  };
}

function revalidateKurse(...paths: string[]) {
  revalidatePath("/kurse");
  revalidatePath("/planer");
  revalidatePath("/dashboard");
  revalidatePath("/anmeldungen");
  for (const p of paths) revalidatePath(p);
}

// ——— Kurs anlegen / bearbeiten ———————————————————————————————————

export async function saveKursAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKursManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const spracheId = str(formData, "spracheId");
  const niveauId = str(formData, "niveauId");
  const kursartId = str(formData, "kursartId");
  const lehrpersonId = str(formData, "lehrpersonId") || null;
  const kursortExtern = str(formData, "kursort") === "extern";
  const externOrt = str(formData, "externOrt");
  const standardRaumId = str(formData, "standardRaumId") || null;
  const hatTermin = str(formData, "hatTermin") === "1";
  const wochentagRaw = Number.parseInt(str(formData, "wochentag"), 10);
  const startZeitRaw = normalizeTimeInput(str(formData, "startZeit"));
  const dauerRaw = Number.parseInt(str(formData, "dauerMinuten"), 10);
  const maxRaw = str(formData, "maxParticipants");

  const fieldErrors: Record<string, string> = {};
  if (!spracheId) fieldErrors.spracheId = "Pflichtfeld";
  if (!kursartId) fieldErrors.kursartId = "Pflichtfeld";
  if (!id && !niveauId) fieldErrors.niveauId = "Pflichtfeld";

  // Wochentermin: alle drei Angaben zusammen — Basis der rollierenden
  // Lektionsgenerierung (Modul 6). Pflichtenheft: kein Kurs startet nach 21:00.
  let wochentag: number | null = null;
  let startZeit: string | null = null;
  let dauerMinuten: number | null = null;
  if (hatTermin) {
    if (!Number.isInteger(wochentagRaw) || wochentagRaw < 1 || wochentagRaw > 6) {
      fieldErrors.wochentag = "Wochentag wählen (Montag–Samstag)";
    } else {
      wochentag = wochentagRaw;
    }
    if (!startZeitRaw) {
      fieldErrors.startZeit = "z.B. 18:00";
    } else {
      const minuten = Number(startZeitRaw.slice(0, 2)) * 60 + Number(startZeitRaw.slice(3, 5));
      if (minuten < 6 * 60 + 30 || minuten > 21 * 60) {
        fieldErrors.startZeit = "Start zwischen 06:30 und 21:00";
      } else {
        startZeit = startZeitRaw;
      }
    }
    if (!Number.isInteger(dauerRaw) || dauerRaw < 30 || dauerRaw > 240) {
      fieldErrors.dauerMinuten = "Lektionsdauer wählen";
    } else {
      dauerMinuten = dauerRaw;
    }
  }

  let extern = false;
  let externOrtFeld: string | null = null;
  let raum: string | null = null;
  if (kursortExtern) {
    extern = true;
    if (!externOrt) {
      fieldErrors.externOrt = "Ort des externen Unterrichts angeben";
    } else {
      externOrtFeld = externOrt;
    }
  } else if (!standardRaumId) {
    fieldErrors.standardRaumId = "Raum wählen — oder «Kursort extern»";
  } else {
    raum = standardRaumId;
  }

  const maxParticipants = maxRaw === "" ? null : Number.parseInt(maxRaw, 10);
  if (maxRaw !== "" && (!Number.isInteger(maxParticipants) || maxParticipants! < 1 || maxParticipants! > 30)) {
    fieldErrors.maxParticipants = "Zahl zwischen 1 und 30 (leer = Kursart-Standard)";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const [sprache, kursart] = await Promise.all([
    db.orm.public.Sprache.where({ id: spracheId }).first(),
    db.orm.public.Kursart.where({ id: kursartId }).first(),
  ]);
  if (!sprache || !kursart) return { error: "Sprache oder Kursart nicht gefunden." };

  let lehrKuerzel: string | null = null;
  if (lehrpersonId) {
    const lehr = await db.orm.public.Person.where({ id: lehrpersonId }).first();
    if (!lehr?.istLehrperson) return { error: "Die gewählte Person ist keine Lehrperson." };
    lehrKuerzel = lehr.kuerzel;
  }

  const data = {
    spracheId,
    kursartId,
    lehrpersonId,
    wochentag,
    startZeit,
    dauerMinuten,
    standardRaumId: raum,
    extern,
    externOrt: externOrtFeld,
    maxParticipants,
    kostentraegerId: str(formData, "kostentraegerId") || null,
    notizen: str(formData, "notizen") || null,
  };

  let createdId: string | null = null;
  try {
    if (id) {
      const existing = await db.orm.public.Kurs.where({ id }).first();
      if (!existing) return { error: "Kurs nicht gefunden." };
      // Niveau ändert sich ausschliesslich über den Niveau-Verlauf; der Code
      // bleibt stabil (Identifier für Historie, Bestätigungen, Rechnungen).
      await db.orm.public.Kurs.where({ id }).update(data);
      await recordAudit({
        actor,
        action: "kurs.update",
        entity: "kurs",
        entityId: id,
        summary: `Kurs «${existing.code}» geändert`,
        details: { ...data },
      });
      revalidateKurse(`/kurse/${id}`);
      return { success: "Kurs gespeichert." };
    }

    // Neu anlegen: Niveau (Start-Niveau) gehört zum Code.
    const niveau = await db.orm.public.Niveau.where({ id: niveauId }).first();
    if (!niveau) return { error: "Niveau nicht gefunden." };
    const maxTeilnehmende = data.maxParticipants ?? kursart.maxParticipants ?? null;

    let kursId: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = await naechsterKursCode(sprache.code, niveau.code, kursart.name, lehrKuerzel);
      try {
        const created = await db.orm.public.Kurs.create({
          ...data,
          maxParticipants: maxTeilnehmende,
          code,
          status: "GEPLANT",
          niveauId,
        });
        kursId = created.id;
        break;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 9) continue;
        throw error;
      }
    }
    if (!kursId) return { error: "Kurscode konnte nicht vergeben werden (Kollisionen)." };

    // Erster Niveau-Abschnitt ab heute (Verlauf, Modul 4).
    await db.orm.public.KursNiveauVerlauf.create({
      kursId,
      niveauId,
      von: dbDatum(heuteDateKey()),
      bis: null,
      gemeldetVonLehrperson: false,
    });

    await recordAudit({
      actor,
      action: "kurs.create",
      entity: "kurs",
      entityId: kursId,
      summary: `Kurs «${sprache.code}-${niveau.code}-${kursart.name}${lehrKuerzel ? `-${lehrKuerzel}` : ""}» angelegt`,
      details: { ...data, niveauId, startNiveau: niveau.code },
    });

    revalidateKurse();
    createdId = kursId;
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Bezugsdaten (Sprache/Niveau/Kursart/Raum/Lehrperson) nicht gefunden." };
    }
    console.error("Kurs speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }

  // redirect() wirft — bewusst ausserhalb des try/catch.
  if (createdId) redirect(`/kurse/${createdId}`);
  return { success: "Kurs gespeichert." };
}

// ——— Kursstatus ——————————————————————————————————————————————————

export async function setKursStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKursManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const kursId = str(formData, "kursId");
  const statusRaw = str(formData, "status") as KursStatus;
  if (!KURS_STATUS_WERTE.includes(statusRaw)) {
    return { error: "Unbekannter Kursstatus." };
  }

  const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
  if (!kurs) return { error: "Kurs nicht gefunden." };

  await db.orm.public.Kurs.where({ id: kursId }).update({ status: statusRaw });
  await recordAudit({
    actor,
    action: "kurs.status",
    entity: "kurs",
    entityId: kursId,
    summary: `Kurs «${kurs.code}»: Status ${kurs.status} → ${statusRaw}`,
  });
  revalidateKurse(`/kurse/${kursId}`);
  return { success: "Status geändert." };
}

// ——— Niveau-Verlauf ——————————————————————————————————————————————

/**
 * Niveau-Wechsel durchführen: beendet den laufenden Abschnitt am Vortag,
 * eröffnet den neuen Abschnitt und passt den Kurscode an.
 */
export async function addNiveauWechselAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const kursId = str(formData, "kursId");
  const zugriff = await requireKursZugriff(kursId);
  if ("failure" in zugriff) return zugriff.failure;

  const niveauId = str(formData, "niveauId");
  const datumRaw = str(formData, "datum");
  if (!parseDateKey(datumRaw)) {
    return { error: "Bitte ein gültiges Wechseldatum angeben.", fieldErrors: { datum: "TT.MM.JJJJ" } };
  }

  const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
  if (!kurs) return { error: "Kurs nicht gefunden." };
  if (kurs.niveauId === niveauId) {
    return { error: "Der Kurs führt dieses Niveau bereits." };
  }
  const niveau = await db.orm.public.Niveau.where({ id: niveauId }).first();
  if (!niveau) return { error: "Niveau nicht gefunden." };

  try {
    const wechsel = await fuehreNiveauWechselAus(kursId, niveauId, datumRaw, zugriff.alsLehrperson);
    await recordAudit({
      actor: zugriff.actor,
      action: zugriff.alsLehrperson ? "kurs.niveauwechsel_gemeldet" : "kurs.niveauwechsel",
      entity: "kurs",
      entityId: kursId,
      summary: `Niveau-Wechsel bei «${kurs.code}»: neues Niveau ${niveau.code} ab ${datumRaw} → Code ${wechsel.neuerCode}`,
      details: { von: kurs.niveauId, zu: niveauId, datum: datumRaw, neuerCode: wechsel.neuerCode },
    });
    revalidateKurse(`/kurse/${kursId}`);

    // Modul 10: Der Wechsel schliesst den bisherigen Abschnitt ab → automatisch
    // Kursbestätigungen für alle aktiven Teilnehmenden erzeugen (best effort:
    // der Wechsel bleibt gültig, das Büro kann manuell erzeugen).
    let bestaetigungsHinweis = "";
    if (wechsel.geschlossenerVerlaufId) {
      try {
        const ergebnis = await erzeugeBestaetigungenFuerAbschnitt({
          verlaufId: wechsel.geschlossenerVerlaufId,
          ausloeser: "NIVEAU_WECHSEL",
          actor: zugriff.actor,
        });
        if (ergebnis.personen.length > 0) {
          bestaetigungsHinweis =
            ` Kursbestätigungen Niveau ${ergebnis.niveauCode} für ${ergebnis.personen.length} ` +
            `aktive Teilnehmende im Portal bereitgestellt.`;
        }
      } catch (error) {
        console.error("Automatische Kursbestätigungen fehlgeschlagen:", error);
        bestaetigungsHinweis = " Kursbestätigungen konnten nicht automatisch erzeugt werden — das Büro kann sie manuell erzeugen.";
      }
    }

    return { success: `Niveau-Wechsel erfasst — neuer Kurscode: ${wechsel.neuerCode}.${bestaetigungsHinweis}` };
  } catch (error) {
    console.error("Niveau-Wechsel fehlgeschlagen:", error);
    return { error: "Niveau-Wechsel fehlgeschlagen." };
  }
}

/** Gemeinsame Kernlogik (Büro-Aktion und Lehrpersonen-Meldung). */
async function fuehreNiveauWechselAus(
  kursId: string,
  niveauId: string,
  datumKey: string,
  gemeldetVonLehrperson: boolean,
): Promise<{ neuerCode: string; geschlossenerVerlaufId: string | null }> {
  const kurs = await db.orm.public.Kurs
    .where({ id: kursId })
    .include("sprache")
    .include("kursart")
    .first();
  if (!kurs) throw new Error("Kurs nicht gefunden");

  const niveau = await db.orm.public.Niveau.where({ id: niveauId }).first();
  if (!niveau) throw new Error("Niveau nicht gefunden");

  // Lehrkürzel bleibt so stabil wie möglich: der bisherige Code ist massgebend.
  const altTeile = zerlegeKursCode(kurs.code);
  let lehrKuerzel: string | null = altTeile?.lehrKuerzel ?? null;
  if (!lehrKuerzel && kurs.lehrpersonId) {
    const lehr = await db.orm.public.Person.where({ id: kurs.lehrpersonId }).first();
    lehrKuerzel = lehr?.kuerzel ?? null;
  }

  let geschlossenerVerlaufId: string | null = null;
  await db.transaction(async (tx) => {
    // Laufenden Abschnitt (anderes Niveau) am Vortag beenden.
    const abschnitte = await tx.orm.public.KursNiveauVerlauf.where({ kursId }).all();
    const offener = abschnitte.find((a) => a.bis === null && a.niveauId !== niveauId);
    if (offener) {
      await tx.orm.public.KursNiveauVerlauf
        .where({ id: offener.id })
        .update({ bis: dbDatum(addDays(datumKey, -1)) });
      geschlossenerVerlaufId = offener.id;
    }
    // Neuen Abschnitt eröffnen.
    await tx.orm.public.KursNiveauVerlauf.create({
      kursId,
      niveauId,
      von: dbDatum(datumKey),
      bis: null,
      gemeldetVonLehrperson,
    });
  });

  // Kurscode anpassen: Serial möglichst behalten.
  const neuerCode = await naechsterKursCode(
    kurs.sprache.code,
    niveau.code,
    kurs.kursart.name,
    lehrKuerzel,
    altTeile?.serial,
  );
  await db.orm.public.Kurs.where({ id: kursId }).update({ niveauId, code: neuerCode });
  return { neuerCode, geschlossenerVerlaufId };
}

// ——— Unterbrechungen ——————————————————————————————————————————————

export async function addUnterbrechungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const kursId = str(formData, "kursId");
  const zugriff = await requireKursZugriff(kursId);
  if ("failure" in zugriff) return zugriff.failure;

  const vonRaw = str(formData, "von");
  const bisRaw = str(formData, "bis");
  const grund = str(formData, "grund") || null;
  if (!parseDateKey(vonRaw) || !parseDateKey(bisRaw)) {
    return { error: "Bitte Von- und Bis-Datum angeben." };
  }
  if (bisRaw < vonRaw) {
    return { error: "Das Bis-Datum liegt vor dem Von-Datum." };
  }
  const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
  if (!kurs) return { error: "Kurs nicht gefunden." };

  await db.orm.public.KursUnterbrechung.create({
    kursId,
    von: dbDatum(vonRaw),
    bis: dbDatum(bisRaw),
    grund,
    gemeldetVonLehrperson: zugriff.alsLehrperson,
  });
  await recordAudit({
    actor: zugriff.actor,
    action: zugriff.alsLehrperson ? "kurs.unterbrechung_gemeldet" : "kurs.unterbrechung",
    entity: "kurs",
    entityId: kursId,
    summary: `Unterbrechung bei «${kurs.code}» erfasst: ${vonRaw} bis ${bisRaw}${grund ? ` (${grund})` : ""}`,
    details: { von: vonRaw, bis: bisRaw, grund },
  });
  revalidateKurse(`/kurse/${kursId}`);
  return { success: "Unterbrechung erfasst." };
}

export async function removeUnterbrechungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKursManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const unterbrechungId = str(formData, "unterbrechungId");
  const unterbrechung = await db.orm.public.KursUnterbrechung.where({ id: unterbrechungId }).first();
  if (!unterbrechung) return { error: "Unterbrechung nicht gefunden." };

  await db.orm.public.KursUnterbrechung.where({ id: unterbrechungId }).delete();
  await recordAudit({
    actor,
    action: "kurs.unterbrechung_remove",
    entity: "kurs",
    entityId: unterbrechung.kursId,
    summary: `Unterbrechung bei Kurs ${unterbrechung.kursId} entfernt`,
  });
  revalidateKurse(`/kurse/${unterbrechung.kursId}`);
  return { success: "Unterbrechung entfernt." };
}

// ——— Kurs löschen (nur wenn unbenutzt) ————————————————————————————

export async function deleteKursAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireKursManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const kursId = str(formData, "kursId");
  const kurs = await db.orm.public.Kurs.where({ id: kursId }).first();
  if (!kurs) return { error: "Kurs nicht gefunden." };

  const [anmeldungen, lektionen] = await Promise.all([
    db.orm.public.Anmeldung.where({ kursId }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.Lektion.where({ kursId }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  if (anmeldungen > 0 || lektionen > 0) {
    return {
      error:
        "Dieser Kurs hat Anmeldungen oder Lektionen und kann nicht gelöscht werden. Bitte Status «abgesagt» oder «abgeschlossen» setzen.",
    };
  }

  try {
    // Niveau-Verlauf und Unterbrechungen laufen als Kursdaten mit (Cascade).
    await db.orm.public.Kurs.where({ id: kursId }).delete();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "Der Kurs wird bereits verwendet und kann nicht gelöscht werden." };
    }
    console.error("Kurs löschen fehlgeschlagen:", error);
    return { error: "Löschen fehlgeschlagen." };
  }

  await recordAudit({
    actor,
    action: "kurs.delete",
    entity: "kurs",
    entityId: kursId,
    summary: `Kurs «${kurs.code}» gelöscht (ohne Anmeldungen/Lektionen)`,
  });
  revalidateKurse();
  redirect("/kurse");
}
