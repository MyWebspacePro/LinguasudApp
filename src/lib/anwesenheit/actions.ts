"use server";

// Anwesenheits-Server-Actions (Modul 7): Erfassung direkt nach der Lektion —
// Lehrperson im 24-h-Fenster für ihre eigenen Lektionen, danach nur noch Büro.
// Abschliessen erst bei vollständiger Erfassung → bucht das Guthaben-Journal
// (anwesend −1, unentschuldigt −1, entschuldigt −0; Probe ohne Abbuchung),
// danach Paketende-Automatik prüfen und ggf. Teilnehmende informieren.
// Büro korrigiert nachträglich (Journal-Eintrag wird angepasst, alles Audit).

import { revalidatePath } from "next/cache";
import { db, toDbTime, type AnwesenheitStatus, type Role } from "@/lib/db";
import { fromDbTime } from "@/lib/domain";
import { getAuthContext } from "@/lib/auth/session";
import { canManageAnmeldungen, hasRole } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { sendMail } from "@/lib/mail";
import { deltaVonAnwesenheit, istFensterAbgelaufen, istVollstaendigErfasst, journalArtVonAnwesenheit } from "./logik";
import { paketendeErreicht, verbrauchtImPaket, type JournalEintrag } from "@/lib/anmeldungen/paket";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function roleListOf(ctx: { user: { roles: unknown } }): Role[] {
  return ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
}

interface ActionUser {
  id: string;
  email: string;
  name: string;
  personId: string | null;
}

/**
 * Wächter der Anwesenheits-Erfassung: Büro (Admin/Chef/Büro) darf überall und
 * jederzeit; Lehrpersonen nur für ihre eigene Lektion und nur innerhalb des
 * 24-h-Fensters nach dem Lektionsende (Pflichtenheft Modul 7).
 */
async function requireAnwesenheitZugriff(
  lektionId: string,
): Promise<{ actor: ActionUser; lektion: LektionBasis; alsLehrperson: boolean } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = roleListOf(ctx);
  if (!canManageAnmeldungen(rollen) && !hasRole(rollen, "LEHRPERSON")) {
    return { failure: { error: "Die Anwesenheitserfassung ist dem Büro und den Lehrpersonen vorbehalten." } };
  }
  const actor: ActionUser = {
    id: ctx.user.id,
    email: ctx.user.email,
    name: `${ctx.user.firstName} ${ctx.user.lastName}`,
    personId: ctx.user.personId,
  };

  const lektion = await ladeLektion(lektionId);
  if (!lektion) return { failure: { error: "Lektion nicht gefunden." } };

  if (!canManageAnmeldungen(rollen)) {
    if (!actor.personId || lektion.lehrpersonId !== actor.personId) {
      return { failure: { error: "Sie können nur die Anwesenheit Ihrer eigenen Lektionen erfassen." } };
    }
    if (istFensterAbgelaufen(lektion.endeDbTime)) {
      return { failure: { error: "Das 24-h-Fenster für die Erfassung ist abgelaufen — bitte das Büro bitten, die Anwesenheit zu erfassen oder zu korrigieren." } };
    }
  }
  return { actor, lektion, alsLehrperson: !canManageAnmeldungen(rollen) };
}

interface LektionBasis {
  id: string;
  kursId: string;
  kursCode: string;
  lehrpersonId: string | null;
  startAt: string;
  /** Lektionsende als DB-Zeit (Basis des 24-h-Fensters). */
  endeDbTime: string;
  status: string;
}

async function ladeLektion(lektionId: string): Promise<LektionBasis | null> {
  const lektion = await db.orm.public.Lektion.where({ id: lektionId }).include("kurs").first();
  if (!lektion) return null;
  return {
    id: lektion.id,
    kursId: lektion.kursId,
    kursCode: lektion.kurs.code,
    lehrpersonId: lektion.lehrpersonId,
    startAt: lektion.startAt,
    endeDbTime: toDbTime(new Date(fromDbTime(lektion.startAt).getTime() + lektion.dauerMinuten * 60_000)),
    status: lektion.status,
  };
}

function revalidateAnwesenheit(kursId?: string) {
  revalidatePath("/planer");
  revalidatePath("/dashboard");
  revalidatePath("/anmeldungen");
  if (kursId) revalidatePath(`/kurse/${kursId}`);
}

/** Anwesenheiten + Anmeldungen einer Lektion (für Vollständigkeitsprüfung). */
async function anwesenheitenUndAnmeldungen(lektionId: string, kursId: string) {
  const [einträge, anmeldungen] = await Promise.all([
    db.orm.public.Anwesenheit.where({ lektionId }).all(),
    db.orm.public.Anmeldung
      .where({ kursId })
      .where((a) => a.status.in(["AKTIV", "PROBE"]))
      .include("person")
      .all(),
  ]);
  return { einträge, anmeldungen };
}

// ——— Einzelne Anwesenheit erfassen / ändern ————————————————————————

/**
 * Status einer Anmeldung in der Lektion setzen (anwesend / abwesend
 * entschuldigt / abwesend unentschuldigt). Nach dem Abschluss nur noch als
 * Büro-Korrektur (passt den Journal-Eintrag an).
 */
export async function speichereAnwesenheitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const lektionId = str(formData, "lektionId");
  const anmeldungId = str(formData, "anmeldungId");
  const statusRaw = str(formData, "status") as AnwesenheitStatus;
  const bemerkung = str(formData, "bemerkung") || null;

  const zugriff = await requireAnwesenheitZugriff(lektionId);
  if ("failure" in zugriff) return zugriff.failure;
  const { actor, lektion, alsLehrperson } = zugriff;

  if (!["ANWESEND", "ABWESEND_ENTSCHULDIGT", "ABWESEND_UNENTSCHULDIGT"].includes(statusRaw)) {
    return { error: "Unbekannter Anwesenheits-Status." };
  }
  if (lektion.status === "ABGESAGT") {
    return { error: "Die Lektion ist abgesagt — keine Anwesenheit erfassbar." };
  }

  const { einträge, anmeldungen } = await anwesenheitenUndAnmeldungen(lektionId, lektion.kursId);
  const anmeldung = anmeldungen.find((a) => a.id === anmeldungId);
  if (!anmeldung) return { error: "Diese Anmeldung gehört nicht zu dieser Lektion (oder ist beendet)." };

  const bestehend = einträge.find((e) => e.anmeldungId === anmeldungId);
  const abgeschlossen = lektion.status === "DURCHGEFUEHRT";
  if (abgeschlossen && alsLehrperson) {
    return { error: "Die Lektion ist abgeschlossen — Korrekturen macht das Büro." };
  }

  const jetzt = toDbTime(new Date());
  if (bestehend) {
    await db.orm.public.Anwesenheit.where({ id: bestehend.id }).update({
      status: statusRaw,
      bemerkung,
      erfasstVonName: actor.name,
      vonLehrperson: alsLehrperson,
      erfasstAt: jetzt,
      korrigiertAt: abgeschlossen ? jetzt : null,
    });
  } else {
    await db.orm.public.Anwesenheit.create({
      lektionId,
      anmeldungId,
      status: statusRaw,
      bemerkung,
      erfasstVonName: actor.name,
      vonLehrperson: alsLehrperson,
      erfasstAt: jetzt,
    });
  }

  // Nach dem Abschluss die Buchung angleichen (Büro-Korrektur).
  let buchungsHinweis = "";
  if (abgeschlossen && anmeldung.status === "AKTIV") {
    await angleicheJournalEintrag(lektionId, lektion.startAt, anmeldungId, statusRaw, actor);
    buchungsHinweis = " Guthaben-Korrektur gebucht.";
  }

  const person = anmeldung.person;
  await recordAudit({
    actor,
    action: bestehend ? "anwesenheit.korrigiert" : "anwesenheit.erfasst",
    entity: "lektion",
    entityId: lektionId,
    summary:
      `Anwesenheit «${person.vorname} ${person.nachname}» in Lektion ${lektion.kursCode}: ` +
      `${bestehend ? bestehend.status : "—"} → ${statusRaw}${bemerkung ? ` (${bemerkung})` : ""}` +
      (alsLehrperson ? " — durch Lehrperson" : " — durch Büro") +
      (abgeschlossen ? " — nachträglich korrigiert" : ""),
    details: { anmeldungId, status: statusRaw, bemerkung, nachAbschluss: abgeschlossen },
  });
  revalidateAnwesenheit(lektion.kursId);
  return { success: `Anwesenheit gespeichert.${buchungsHinweis}` };
}

/** Journal-Eintrag einer abgeschlossenen Lektion an den neuen Status anpassen. */
async function angleicheJournalEintrag(
  lektionId: string,
  startAt: string,
  anmeldungId: string,
  status: AnwesenheitStatus,
  actor: ActionUser,
): Promise<void> {
  const art = journalArtVonAnwesenheit(status);
  const delta = deltaVonAnwesenheit(status);
  const bestehend = await db.orm.public.GuthabenJournal
    .where({ lektionId, anmeldungId })
    .where((j) => j.art.in(["VERBRAUCH", "FEHLZEIT_UNENTSCHULDIGT", "FEHLZEIT_ENTSCHULDIGT"]))
    .first();
  if (bestehend) {
    await db.orm.public.GuthabenJournal.where({ id: bestehend.id }).update({
      art,
      delta,
      actorUserId: actor.id,
      actorName: actor.name,
    });
  } else {
    await db.orm.public.GuthabenJournal.create({
      anmeldungId,
      art,
      delta,
      datum: startAt,
      lektionId,
      bemerkung: "Nachträgliche Anwesenheits-Korrektur",
      actorUserId: actor.id,
      actorName: actor.name,
    });
  }
}

// ——— Lektion abschliessen (bucht das Guthaben) ——————————————————————

/**
 * Schliesst die Lektion ab: Status DURCHGEFUEHRT, Guthaben-Buchungen je
 * aktiver Anmeldung (mit Lektions-Link im Journal) und Paketende-Automatik
 * (Schwelle erreicht → Teilnehmende informieren, Marker setzen).
 */
export async function schliesseLektionAbAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const lektionId = str(formData, "lektionId");
  const zugriff = await requireAnwesenheitZugriff(lektionId);
  if ("failure" in zugriff) return zugriff.failure;
  const { actor, lektion, alsLehrperson } = zugriff;

  if (lektion.status === "ABGESAGT") return { error: "Eine abgesagte Lektion kann nicht abgeschlossen werden." };
  if (lektion.status === "DURCHGEFUEHRT") return { error: "Die Lektion ist bereits abgeschlossen." };

  const { einträge, anmeldungen } = await anwesenheitenUndAnmeldungen(lektionId, lektion.kursId);
  const erfasst = new Map(einträge.map((e) => [e.anmeldungId, e.status]));
  if (!istVollstaendigErfasst(anmeldungen, erfasst)) {
    const offen = anmeldungen.filter((a) => a.status === "AKTIV" && !erfasst.has(a.id));
    return {
      error:
        `Anwesenheit ist nicht vollständig erfasst (offen: ${offen.map((a) => `${a.person.vorname} ${a.person.nachname}`).join(", ")}). ` +
        "Abschliessen erst, wenn alle aktiven Teilnehmenden erfasst sind.",
    };
  }

  const aktiveAnmeldungen = anmeldungen.filter((a) => a.status === "AKTIV");
  await db.transaction(async (tx) => {
    for (const anmeldung of aktiveAnmeldungen) {
      const status = erfasst.get(anmeldung.id)!;
      await tx.orm.public.GuthabenJournal.create({
        anmeldungId: anmeldung.id,
        art: journalArtVonAnwesenheit(status),
        delta: deltaVonAnwesenheit(status),
        datum: lektion.startAt,
        lektionId,
        bemerkung: `Anwesenheit ${lektion.kursCode}${status === "ABWESEND_ENTSCHULDIGT" ? " (entschuldigt)" : ""}`,
        actorUserId: actor.id,
        actorName: actor.name,
      });
    }
    await tx.orm.public.Lektion.where({ id: lektionId }).update({
      status: "DURCHGEFUEHRT",
      abgeschlossenAt: toDbTime(new Date()),
    });
  });

  // Paketende-Automatik (12./13. Lektion): Schwelle erreicht → informieren.
  const paketendeHinweise: string[] = [];
  for (const anmeldung of aktiveAnmeldungen) {
    const journal = await db.orm.public.GuthabenJournal.where({ anmeldungId: anmeldung.id }).all();
    const eintraege: JournalEintrag[] = journal.map((j) => ({ art: j.art, delta: j.delta, datum: String(j.datum) }));
    const verbraucht = verbrauchtImPaket(eintraege, String(anmeldung.paketStartAt));
    if (paketendeErreicht(verbraucht, anmeldung.paketGroesse) && anmeldung.paketEntscheid === "OFFEN" && !anmeldung.paketEndeGemeldetAt) {
      await informierePaketende(anmeldung.id, anmeldung.person.email, anmeldung.person.vorname, anmeldung.person.nachname, lektion.kursCode, anmeldung.paketGroesse, verbraucht);
      await db.orm.public.Anmeldung.where({ id: anmeldung.id }).update({ paketEndeGemeldetAt: toDbTime(new Date()) });
      paketendeHinweise.push(`${anmeldung.person.vorname} ${anmeldung.person.nachname}`);
    }
  }

  await recordAudit({
    actor,
    action: "anwesenheit.abgeschlossen",
    entity: "lektion",
    entityId: lektionId,
    summary:
      `Lektion ${lektion.kursCode} abgeschlossen: ${aktiveAnmeldungen.length} aktive Anmeldung(en) verbucht ` +
      `(anwesend −1 / unentschuldigt −1 / entschuldigt −0${alsLehrperson ? ", durch Lehrperson" : ""})` +
      (paketendeHinweise.length ? ` — Paketende-Automatik informierte: ${paketendeHinweise.join(", ")}` : ""),
    details: {
      buchungen: aktiveAnmeldungen.map((a) => {
        const status = erfasst.get(a.id)!;
        return { anmeldungId: a.id, status, delta: deltaVonAnwesenheit(status) };
      }),
      paketendeInformiert: paketendeHinweise,
    },
  });
  revalidateAnwesenheit(lektion.kursId);
  return {
    success:
      `Lektion abgeschlossen — ${aktiveAnmeldungen.length} Buchung(en) ins Guthaben-Journal.` +
      (paketendeHinweise.length ? ` Paketende-Automatik: ${paketendeHinweise.join(", ")} wurden informiert.` : ""),
  };
}

/** «Fortfahren oder beenden?»-Mail am Paketende (wie Modul 5, automatisch ausgelöst). */
async function informierePaketende(
  anmeldungId: string,
  email: string | null,
  vorname: string,
  nachname: string,
  kursCode: string,
  paketGroesse: number,
  verbraucht: number,
): Promise<void> {
  if (!email) return;
  const rest = Math.max(0, paketGroesse - verbraucht);
  await sendMail({
    to: email,
    subject: `Ihr Paket in ${kursCode} läuft zu Ende`,
    text:
      `Hallo ${vorname} ${nachname}\n\n` +
      `Ihr aktuelles Paket (${paketGroesse} Lektionen) ist bald aufgebraucht: noch ${rest} Lektionen.\n` +
      `Möchten Sie fortfahren (nächste ${paketGroesse} Lektionen) oder beenden?\n` +
      `Bitte melden Sie sich im Büro der Sprachschule linguasud.\n`,
    html:
      `<p style="margin:0 0 8px;font-size:14px;">Hallo ${vorname} ${nachname},</p>` +
      `<p style="margin:0 0 8px;font-size:14px;">Ihr aktuelles Paket (${paketGroesse} Lektionen) ist bald aufgebraucht: noch <strong>${rest} Lektionen</strong>.</p>` +
      `<p style="margin:0 0 8px;font-size:14px;">Möchten Sie <strong>fortfahren</strong> (nächste ${paketGroesse} Lektionen) oder <strong>beenden</strong>?</p>` +
      `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Kurs: ${kursCode} · Sprachschule linguasud</p>`,
  }).catch((error) => {
    console.error("Paketende-Mail fehlgeschlagen:", error);
  });
}

/** System-Audit für den automatischen Paketende-Hinweis kommt über recordAudit in der Action. */
