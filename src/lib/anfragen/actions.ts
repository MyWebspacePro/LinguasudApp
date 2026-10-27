"use server";

// Anfragen (Modul 13, Server-Actions):
// - Öffentlich: Einstufungstest auswerten (redirect aufs Ergebnis) und das
//   Anfrage-Formular (Drossel + Honeypot, Bestätigungs- und Büro-Mail,
//   automatische Büro-Aufgabe, Audit mit actor: null).
// - Verwaltung (Admin/Chef/Büro, Muster canManageAnmeldungen): Statuswechsel,
//   Zuordnung nach Identitätsprüfung (bestehende Person oder neue
//   INTERESSENT-Person) — alles im Audit-Log (anfrage.*).
// - Fragenkatalog (nur Admin, Stammdaten): Fragen pflegen.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, roleList, toDbTime, type Anrede } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageAnfragen, canManageStammdaten } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { sendMail, anfrageBestaetigungsMail, anfrageBueroMail } from "@/lib/mail";
import type { FormState } from "@/lib/forms";
import { addDays, dateKeyToUtcMidnight, heuteDateKey } from "@/lib/zeit";
import {
  formatiereTestResultat,
  istGueltigeEmail,
  niveauEmpfehlung,
  parseTestResultat,
  type NiveauErgebnis,
} from "./logik";
import { istDrosselAktiv, registriereVersuch } from "./drossel";
import { erledigeAutomatikAufgabe, erstelleAutomatischeAufgabe } from "@/lib/aufgaben/automatik";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const FORM_NAME = "anfrage";

/** Büro-Postfach für die Anfrage-Benachrichtigung (überschreibbar via SystemSetting). */
const BUERO_EMAIL_KEY = "anfragen.bueroEmail";
const BUERO_EMAIL_FALLBACK = "buero@linguasud.com";

async function bueroEmail(): Promise<string> {
  const setting = await db.orm.public.SystemSetting.where({ key: BUERO_EMAIL_KEY }).first();
  return setting?.value.trim() || BUERO_EMAIL_FALLBACK;
}

function revalidateAnfragen(...paths: string[]) {
  revalidatePath("/anfragen");
  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  revalidatePath("/personen");
  for (const p of paths) revalidatePath(p);
}

// ——— Öffentlich: Einstufungstest —————————————————————————————————————————

/**
 * Wertet den Multiple-Choice-Test aus (Fragen werden serverseitig erneut
 * geladen, die Antworten werden nicht vertrauenswürdig übernommen) und
 * leitet auf die Ergebnis-Seite weiter — die Empfehlung reist als kompaktes
 * Resultat in der URL zum Anfrage-Formular.
 */
export async function einstufungsTestAction(formData: FormData): Promise<void> {
  const spracheId = str(formData, "spracheId");
  if (!spracheId) redirect("/einstufungstest");

  const sprache = await db.orm.public.Sprache.where({ id: spracheId }).first();
  if (!sprache) redirect("/einstufungstest");

  const fragen = await db.orm.public.Einstufungsfrage
    .where((f) => f.spracheId.eq(spracheId))
    .where((f) => f.active.eq(true))
    .include("niveau")
    .all();
  if (fragen.length === 0) redirect(`/einstufungstest/${spracheId}`);

  // Richtige Antworten je Niveau zählen (Sortierung des Niveaus aus den
  // Stammdaten; Stufen ohne Fragen werden unten ausgelassen).
  const niveaus = await db.orm.public.Niveau.orderBy((n) => n.sortOrder.asc()).all();
  const niveauReihenfolge = new Map(niveaus.map((n, i) => [n.id, i]));
  const ergebnisProNiveau = new Map<string, NiveauErgebnis>();
  for (const frage of fragen) {
    const eintrag = ergebnisProNiveau.get(frage.niveauId) ?? {
      code: frage.niveau.code,
      richtig: 0,
      total: 0,
    };
    eintrag.total += 1;
    if (str(formData, `f_${frage.id}`) === String(frage.richtig)) {
      eintrag.richtig += 1;
    }
    ergebnisProNiveau.set(frage.niveauId, eintrag);
  }

  const proNiveau = [...ergebnisProNiveau.entries()]
    .sort(([a], [b]) => (niveauReihenfolge.get(a) ?? 99) - (niveauReihenfolge.get(b) ?? 99))
    .map(([, e]) => e);
  const empfehlung = niveauEmpfehlung(proNiveau);
  const res = formatiereTestResultat({ proNiveau, empfehlungCode: empfehlung?.code ?? null });
  const empfohlenId = empfehlung
    ? (niveaus.find((n) => n.code === empfehlung.code)?.id ?? null)
    : null;

  const params = new URLSearchParams();
  params.set("sprache", spracheId);
  params.set("res", res);
  if (empfohlenId) params.set("niveau", empfohlenId);
  redirect(`/einstufungstest/ergebnis?${params.toString()}`);
}

// ——— Öffentlich: Anfrage-Formular ————————————————————————————————————————

export async function anfrageAbsendenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await getRequestMeta();

  // Honeypot: verstecktes Feld — echte Besucher füllen es nie aus. Bots
  // bekommen eine gefakte Erfolgsmeldung, es passiert nichts.
  if (str(formData, "website") !== "") {
    redirect("/anfrage/erfolg");
  }

  const name = str(formData, "name");
  const emailRaw = str(formData, "email");
  const email = emailRaw.toLowerCase();
  const telefon = str(formData, "telefon") || null;
  const nachricht = str(formData, "nachricht") || null;
  const spracheId = str(formData, "spracheId") || null;
  const niveauId = str(formData, "niveauId") || null;
  const res = str(formData, "res") || null;

  // Drossel (pro E-Mail/IP) — vor der Validierung registrieren, damit auch
  // fehlerhafte Wiederholungen zählen.
  if (await istDrosselAktiv(FORM_NAME, email, meta.ip)) {
    return {
      error:
        "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut oder melden Sie sich telefonisch.",
    };
  }
  await registriereVersuch(FORM_NAME, email, meta.ip);

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Bitte Ihren Namen angeben";
  if (!email) fieldErrors.email = "Bitte Ihre E-Mail-Adresse angeben";
  else if (!istGueltigeEmail(email)) fieldErrors.email = "Ungültige E-Mail-Adresse";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  // Sprache/Niveau/Empfehlung gegen die Stammdaten auflösen (IDs müssen
  // existieren; die Empfehlung kommt aus dem kompakten Test-Resultat).
  const testResultat = parseTestResultat(res);
  const sprache = spracheId ? await db.orm.public.Sprache.where({ id: spracheId }).first() : null;
  const niveau = niveauId ? await db.orm.public.Niveau.where({ id: niveauId }).first() : null;
  const empfohlenesNiveau = testResultat?.empfehlungCode
    ? (await db.orm.public.Niveau.where({ code: testResultat.empfehlungCode }).first())
    : null;

  const created = await db.orm.public.Anfrage.create({
    status: "OFFEN",
    name,
    email,
    telefon,
    nachricht,
    spracheId: sprache?.id ?? null,
    niveauId: niveau?.id ?? null,
    empfohlenesNiveauId: empfohlenesNiveau?.id ?? null,
    // Json-Feld: bewusst als plain Objekt bauen (JsonValue-kompatibel).
    testResultat: testResultat
      ? {
          proNiveau: testResultat.proNiveau.map((e) => ({ code: e.code, richtig: e.richtig, total: e.total })),
          empfehlungCode: testResultat.empfehlungCode,
        }
      : null,
  });

  // Mails und Aufgabe dürfen die Anfrage nicht abbrechen — Fehler werden
  // dokumentiert (bestaetigtVia) bzw. geloggt.
  const zeilen = [
    `Name: ${name}`,
    `E-Mail: ${email}`,
    ...(telefon ? [`Telefon: ${telefon}`] : []),
    ...(sprache ? [`Sprache: ${sprache.name}`] : []),
    ...(niveau ? [`Gewünschtes Niveau: ${niveau.code}`] : []),
    ...(empfohlenesNiveau ? [`Empfehlung aus dem Einstufungstest: ${empfohlenesNiveau.code}`] : []),
  ];
  try {
    const bestaetigung = await sendMail(anfrageBestaetigungsMail(email, name, zeilen));
    await sendMail(
      await anfrageBueroNotification(name, email, telefon, sprache?.name ?? null, niveau?.code ?? null, empfohlenesNiveau?.code ?? null, nachricht),
    );
    await db.orm.public.Anfrage.where({ id: created.id }).update({
      bestaetigtAm: toDbTime(new Date()),
      bestaetigtVia: bestaetigung.delivered ? "email" : bestaetigung.devLogged ? "devlog" : `fehler:${bestaetigung.error ?? "unbekannt"}`,
    });
  } catch (error) {
    console.error("Anfrage-Bestätigung fehlgeschlagen:", error);
    await db.orm.public.Anfrage.where({ id: created.id }).update({ bestaetigtVia: "fehler" });
  }

  try {
    // Büro-Aufgabe (Dedup pro Anfrage): fällig in 2 Tagen.
    await erstelleAutomatischeAufgabe({
      quelle: "anfrage",
      dedupKey: `anfrage:${created.id}`,
      titel: `Neue Anfrage von ${name}`,
      beschreibung:
        `${zeilen.join(" · ")}${nachricht ? `\n\nNachricht: ${nachricht}` : ""}\n\nAnfrage in der Verwaltung bearbeiten: /anfragen/${created.id}`,
      anfrageId: created.id,
      faelligAm: dateKeyToUtcMidnight(addDays(heuteDateKey(), 2)),
    });
  } catch (error) {
    console.error("Automatische Anfrage-Aufgabe fehlgeschlagen:", error);
  }

  await recordAudit({
    actor: null,
    action: "anfrage.eingegangen",
    entity: "anfrage",
    entityId: created.id,
    summary: `Anfrage von «${name}» (${email}) eingegangen${sprache ? ` — Sprache ${sprache.name}` : ""}${empfohlenesNiveau ? `, Empfehlung ${empfohlenesNiveau.code}` : ""}`,
    details: {
      name,
      email,
      telefon,
      spracheId: sprache?.id ?? null,
      niveauId: niveau?.id ?? null,
      empfohlenesNiveauId: empfohlenesNiveau?.id ?? null,
      testResultat: testResultat
        ? {
            proNiveau: testResultat.proNiveau.map((e) => ({ code: e.code, richtig: e.richtig, total: e.total })),
            empfehlungCode: testResultat.empfehlungCode,
          }
        : null,
    },
    request: meta,
  });

  revalidateAnfragen();
  redirect("/anfrage/erfolg");
}

async function anfrageBueroNotification(
  name: string,
  email: string,
  telefon: string | null,
  spracheName: string | null,
  niveauCode: string | null,
  empfehlungCode: string | null,
  nachricht: string | null,
): Promise<ReturnType<typeof anfrageBueroMail>> {
  const zeilen = [
    `Name: ${name}`,
    `E-Mail: ${email}`,
    ...(telefon ? [`Telefon: ${telefon}`] : []),
    ...(spracheName ? [`Sprache: ${spracheName}`] : []),
    ...(niveauCode ? [`Gewünschtes Niveau: ${niveauCode}`] : []),
    ...(empfehlungCode ? [`Empfehlung aus dem Einstufungstest: ${empfehlungCode}`] : []),
  ];
  return anfrageBueroMail(await bueroEmail(), { name, email, telefon, zeilen, nachricht });
}

// ——— Verwaltung: Status & Zuordnung ——————————————————————————————————————

async function requireAnfragenManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageAnfragen(roleList(ctx.user.roles))) {
    return { failure: { error: "Die Anfragen-Verwaltung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

/** Statuswechsel (ausser ZUGEORDNET — das läuft über die Zuordnung). */
export async function setzeAnfrageStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnfragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anfrageId = str(formData, "anfrageId");
  const status = str(formData, "status");
  const ablehnungsGrund = str(formData, "ablehnungsGrund") || null;
  if (status !== "OFFEN" && status !== "IN_BEARBEITUNG" && status !== "ABGELEHNT") {
    return { error: "Ungültiger Status (Zuordnung läuft separat)." };
  }
  if (status === "ABGELEHNT" && !ablehnungsGrund) {
    return { error: "Bitte einen Grund für die Ablehnung angeben.", fieldErrors: { ablehnungsGrund: "Pflichtfeld" } };
  }

  const anfrage = await db.orm.public.Anfrage.where({ id: anfrageId }).first();
  if (!anfrage) return { error: "Anfrage nicht gefunden." };
  if (anfrage.status === "ZUGEORDNET") {
    return { error: "Die Anfrage ist bereits zugeordnet — bitte zuerst die Zuordnung aufheben." };
  }
  if (anfrage.status === status) return { error: "Die Anfrage hat diesen Status bereits." };

  await db.orm.public.Anfrage.where({ id: anfrageId }).update({
    status,
    ablehnungsGrund: status === "ABGELEHNT" ? ablehnungsGrund : null,
  });

  // Ablehnung erledigt auch die offene Anfrage-Aufgabe (Vorgang abgeschlossen).
  let aufgabeErledigt = false;
  if (status === "ABGELEHNT") {
    aufgabeErledigt = await erledigeAutomatikAufgabe(`anfrage:${anfrageId}`, `${actor.name} (abgelehnt)`);
  }

  await recordAudit({
    actor,
    action: "anfrage.status",
    entity: "anfrage",
    entityId: anfrageId,
    summary: `Anfrage von «${anfrage.name}» → ${status === "OFFEN" ? "offen" : status === "IN_BEARBEITUNG" ? "in Bearbeitung" : "abgelehnt"}${ablehnungsGrund ? ` — Grund: ${ablehnungsGrund}` : ""}${aufgabeErledigt ? " (Aufgabe erledigt)" : ""}`,
    details: { status, ablehnungsGrund },
  });
  revalidateAnfragen(`/anfragen/${anfrageId}`);
  return { success: `Status gesetzt: ${status === "OFFEN" ? "offen" : status === "IN_BEARBEITUNG" ? "in Bearbeitung" : "abgelehnt"}.` };
}

/** Zuordnung zu einer bestehenden Person (nach Identitätsprüfung durchs Büro). */
export async function zuordneAnfragePersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnfragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anfrageId = str(formData, "anfrageId");
  const personId = str(formData, "personId");
  if (!personId) return { error: "Bitte eine Person wählen.", fieldErrors: { personId: "Pflichtfeld" } };

  const [anfrage, person] = await Promise.all([
    db.orm.public.Anfrage.where({ id: anfrageId }).first(),
    db.orm.public.Person.where({ id: personId }).first(),
  ]);
  if (!anfrage) return { error: "Anfrage nicht gefunden." };
  if (anfrage.status === "ZUGEORDNET") return { error: "Die Anfrage ist bereits zugeordnet." };
  if (!person) return { error: "Person nicht gefunden." };

  await db.orm.public.Anfrage.where({ id: anfrageId }).update({
    personId,
    status: "ZUGEORDNET",
    zugeordnetAt: toDbTime(new Date()),
    zugeordnetVonName: actor.name,
  });
  const aufgabeErledigt = await erledigeAutomatikAufgabe(`anfrage:${anfrageId}`, `${actor.name} (zugeordnet)`);

  await recordAudit({
    actor,
    action: "anfrage.zugeordnet",
    entity: "anfrage",
    entityId: anfrageId,
    summary: `Anfrage von «${anfrage.name}» der Person «${person.vorname} ${person.nachname}» zugeordnet${aufgabeErledigt ? " (Aufgabe erledigt)" : ""}`,
    details: { personId },
  });
  revalidateAnfragen(`/anfragen/${anfrageId}`, `/personen/${personId}`);
  return { success: `Anfrage «${person.vorname} ${person.nachname}» zugeordnet.` };
}

/** Zuordnung über eine neu angelegte INTERESSENT-Person (Kontaktdaten übernommen). */
export async function zuordneAnfrageNeuePersonAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnfragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anfrageId = str(formData, "anfrageId");
  const anrede = str(formData, "anrede");
  const vorname = str(formData, "vorname");
  const nachname = str(formData, "nachname");

  const fieldErrors: Record<string, string> = {};
  if (anrede !== "HERR" && anrede !== "FRAU" && anrede !== "DIVERS") fieldErrors.anrede = "Anrede wählen";
  if (!vorname) fieldErrors.vorname = "Pflichtfeld";
  if (!nachname) fieldErrors.nachname = "Pflichtfeld";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const anfrage = await db.orm.public.Anfrage.where({ id: anfrageId }).first();
  if (!anfrage) return { error: "Anfrage nicht gefunden." };
  if (anfrage.status === "ZUGEORDNET") return { error: "Die Anfrage ist bereits zugeordnet." };

  let personId: string;
  try {
    const person = await db.orm.public.Person.create({
      status: "INTERESSENT",
      anrede: anrede as Anrede,
      vorname,
      nachname,
      email: anfrage.email,
      telefon1: anfrage.telefon,
    });
    personId = person.id;
    await recordAudit({
      actor,
      action: "person.create",
      entity: "person",
      entityId: personId,
      summary: `Person «${vorname} ${nachname}» (Interessent/in) aus Anfrage angelegt`,
      details: { anfrageId, anrede, vorname, nachname, email: anfrage.email },
    });
  } catch (error) {
    console.error("Person aus Anfrage anlegen fehlgeschlagen:", error);
    return { error: "Person konnte nicht angelegt werden." };
  }

  await db.orm.public.Anfrage.where({ id: anfrageId }).update({
    personId,
    status: "ZUGEORDNET",
    zugeordnetAt: toDbTime(new Date()),
    zugeordnetVonName: actor.name,
  });
  const aufgabeErledigt = await erledigeAutomatikAufgabe(`anfrage:${anfrageId}`, `${actor.name} (zugeordnet)`);

  await recordAudit({
    actor,
    action: "anfrage.neue_person",
    entity: "anfrage",
    entityId: anfrageId,
    summary: `Anfrage von «${anfrage.name}» der neuen Person «${vorname} ${nachname}» (Interessent/in) zugeordnet${aufgabeErledigt ? " (Aufgabe erledigt)" : ""}`,
    details: { personId },
  });
  revalidateAnfragen(`/anfragen/${anfrageId}`, `/personen/${personId}`);
  return { success: `Neue Person «${vorname} ${nachname}» angelegt und zugeordnet.` };
}

/** Zuordnung aufheben (Anfrage zurück in Bearbeitung). */
export async function hebeAnfrageZuordnungAufAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnfragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anfrageId = str(formData, "anfrageId");
  const anfrage = await db.orm.public.Anfrage.where({ id: anfrageId }).first();
  if (!anfrage) return { error: "Anfrage nicht gefunden." };
  if (anfrage.status !== "ZUGEORDNET") return { error: "Die Anfrage ist nicht zugeordnet." };

  await db.orm.public.Anfrage.where({ id: anfrageId }).update({
    personId: null,
    status: "IN_BEARBEITUNG",
    zugeordnetAt: null,
    zugeordnetVonName: null,
  });
  await recordAudit({
    actor,
    action: "anfrage.zuordnung_aufgehoben",
    entity: "anfrage",
    entityId: anfrageId,
    summary: `Zuordnung der Anfrage von «${anfrage.name}» aufgehoben`,
  });
  revalidateAnfragen(`/anfragen/${anfrageId}`);
  return { success: "Zuordnung aufgehoben — Anfrage ist wieder in Bearbeitung." };
}

// ——— Fragenkatalog (Stammdaten, nur Admin) ———————————————————————————————

async function requireFragenManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageStammdaten(roleList(ctx.user.roles))) {
    return { failure: { error: "Der Fragenkatalog ist Admin vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidateFragen() {
  revalidatePath("/stammdaten/einstufungstest");
  revalidatePath("/stammdaten");
  revalidatePath("/einstufungstest");
}

export async function saveEinstufungsfrageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireFragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const spracheId = str(formData, "spracheId");
  const niveauId = str(formData, "niveauId");
  const text = str(formData, "text");
  const antworten = [str(formData, "antwort1"), str(formData, "antwort2"), str(formData, "antwort3"), str(formData, "antwort4")];
  const richtig = Number.parseInt(str(formData, "richtig"), 10);
  const sortOrderRaw = Number.parseInt(str(formData, "sortOrder"), 10);
  const active = str(formData, "active") !== "false";

  const fieldErrors: Record<string, string> = {};
  if (!spracheId) fieldErrors.spracheId = "Sprache wählen";
  if (!niveauId) fieldErrors.niveauId = "Niveau wählen";
  if (!text) fieldErrors.text = "Pflichtfeld";
  antworten.forEach((a, i) => {
    if (!a) fieldErrors[`antwort${i + 1}`] = "Pflichtfeld";
  });
  if (!Number.isInteger(richtig) || richtig < 1 || richtig > 4) fieldErrors.richtig = "Richtige Antwort wählen";
  if (!Number.isInteger(sortOrderRaw) || sortOrderRaw < 0) fieldErrors.sortOrder = "Reihenfolge (Zahl)";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const [sprache, niveau] = await Promise.all([
    db.orm.public.Sprache.where({ id: spracheId }).first(),
    db.orm.public.Niveau.where({ id: niveauId }).first(),
  ]);
  if (!sprache || !niveau) return { error: "Sprache oder Niveau nicht gefunden." };

  const daten = {
    spracheId,
    niveauId,
    text,
    antwort1: antworten[0]!,
    antwort2: antworten[1]!,
    antwort3: antworten[2]!,
    antwort4: antworten[3]!,
    richtig,
    sortOrder: sortOrderRaw,
    active,
  };
  try {
    if (id) {
      const bestehend = await db.orm.public.Einstufungsfrage.where({ id }).first();
      if (!bestehend) return { error: "Frage nicht gefunden." };
      await db.orm.public.Einstufungsfrage.where({ id }).update(daten);
      await recordAudit({
        actor,
        action: "einstufungsfrage.geaendert",
        entity: "einstufungsfrage",
        entityId: id,
        summary: `Einstufungsfrage geändert (${sprache.name}, ${niveau.code}): «${text.slice(0, 60)}${text.length > 60 ? "…" : ""}»`,
        details: daten,
      });
      revalidateFragen();
      return { success: "Frage gespeichert." };
    }
    const created = await db.orm.public.Einstufungsfrage.create(daten);
    await recordAudit({
      actor,
      action: "einstufungsfrage.erstellt",
      entity: "einstufungsfrage",
      entityId: created.id,
      summary: `Einstufungsfrage angelegt (${sprache.name}, ${niveau.code}): «${text.slice(0, 60)}${text.length > 60 ? "…" : ""}»`,
      details: daten,
    });
    revalidateFragen();
    return { success: "Frage angelegt." };
  } catch (error) {
    console.error("Einstufungsfrage speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

/** Frage aktivieren/deaktivieren (inaktive Fragen erscheinen nicht im Test). */
export async function archiviereEinstufungsfrageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireFragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const deaktiviert = str(formData, "deaktiviert") === "true";
  const frage = await db.orm.public.Einstufungsfrage.where({ id }).first();
  if (!frage) return { error: "Frage nicht gefunden." };

  await db.orm.public.Einstufungsfrage.where({ id }).update({
    active: !deaktiviert,
    archivedAt: deaktiviert ? toDbTime(new Date()) : null,
  });
  await recordAudit({
    actor,
    action: "einstufungsfrage.archiviert",
    entity: "einstufungsfrage",
    entityId: id,
    summary: `Einstufungsfrage «${frage.text.slice(0, 60)}» ${deaktiviert ? "deaktiviert" : "aktiviert"}`,
  });
  revalidateFragen();
  return { success: deaktiviert ? "Frage deaktiviert." : "Frage aktiviert." };
}

export async function loescheEinstufungsfrageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireFragenManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const frage = await db.orm.public.Einstufungsfrage.where({ id }).first();
  if (!frage) return { error: "Frage nicht gefunden." };

  await db.orm.public.Einstufungsfrage.where({ id }).delete();
  await recordAudit({
    actor,
    action: "einstufungsfrage.geloescht",
    entity: "einstufungsfrage",
    entityId: id,
    summary: `Einstufungsfrage «${frage.text.slice(0, 60)}» gelöscht`,
  });
  revalidateFragen();
  return { success: "Frage gelöscht." };
}
