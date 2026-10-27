"use server";

// Anmelde-Server-Actions (Modul 5): Drei Billing-Typen (privat / Firma /
// öffentliche Einrichtung), Probelektionen, Tarif automatisch nach Tageszeit
// (übersteuerbar), Paketgrösse 14/15 (übersteuerbar), Preis aus Preisliste
// (übersteuerbar mit dokumentierter Abweichung), Lektionsguthaben als Konto
// mit Journal, Paketende-Automatik (12. von 14 / 13. von 15), Fehlzeiten
// (Büro entscheidet final). Pflegen dürfen Admin/Chef/Büro. Alles Audit.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, toDbTime, type BillingTyp, type Role } from "@/lib/db";
import { BILLING_TYP_WERTE } from "@/lib/domain";
import { getAuthContext } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { sendMail } from "@/lib/mail";
import { dateKeyToUtcMidnight, addDays, heuteDateKey, parseDateKey } from "@/lib/zeit";
import { autoTarifstufe, verbrauchtImPaket, type TarifstufeOption } from "./paket";
import { erstellePaketRechnung } from "@/lib/rechnungen/erstellung";
import { erstelleAutomatischeAufgabe } from "@/lib/aufgaben/automatik";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function roleListOf(ctx: { user: { roles: unknown } }): Role[] {
  return ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
}

async function requireAnmeldeManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageAnmeldungen(roleListOf(ctx))) {
    return { failure: { error: "Die Anmeldungsverwaltung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidateAnmeldungen(...paths: string[]) {
  revalidatePath("/anmeldungen");
  revalidatePath("/kurse");
  revalidatePath("/dashboard");
  for (const p of paths) revalidatePath(p);
}

/** Preislisten-Betrag für Kursart × Dauer(Minuten) × Tarifstufe; null, wenn nicht erfasst. */
async function preislistenBetrag(
  kursartId: string,
  dauerMinuten: number | null,
  tarifstufeId: string,
): Promise<string | null> {
  if (!dauerMinuten) return null;
  const dauer = await db.orm.public.Lektionsdauer.where({ minuten: dauerMinuten }).first();
  if (!dauer) return null;
  const preis = await db.orm.public.Preis
    .where({ kursartId, lektionsdauerId: dauer.id, tarifstufeId })
    .first();
  return preis ? preis.amountChf.toString() : null;
}

// ——— Anmeldung anlegen ————————————————————————————————————————————

export async function saveAnmeldungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const kursId = str(formData, "kursId");
  const personId = str(formData, "personId");
  const billingTypRaw = str(formData, "billingTyp") as BillingTyp;
  const kostentraegerId = str(formData, "kostentraegerId") || null;
  const rechnungsempfaengerId = str(formData, "rechnungsempfaengerId") || null;
  const tarifstufeId = str(formData, "tarifstufeId") || null;
  const paketRaw = str(formData, "paketGroesse");
  const preisRaw = str(formData, "preisChf");
  const preisAbweichungGrund = str(formData, "preisAbweichungGrund");
  const statusRaw = str(formData, "status");
  const notizen = str(formData, "notizen") || null;

  const fieldErrors: Record<string, string> = {};
  if (!kursId) fieldErrors.kursId = "Pflichtfeld";
  if (!personId) fieldErrors.personId = "Pflichtfeld";
  const billingTyp = BILLING_TYP_WERTE.includes(billingTypRaw) ? billingTypRaw : null;
  if (!billingTyp) fieldErrors.billingTyp = "Pflichtfeld";
  const status: "PROBE" | "AKTIV" = statusRaw === "AKTIV" ? "AKTIV" : "PROBE";
  if (statusRaw === "BEENDET") fieldErrors.status = "Neue Anmeldungen starten als Probe oder aktiv";

  if (billingTyp && billingTyp !== "PRIVAT" && !kostentraegerId) {
    fieldErrors.kostentraegerId = "Kostenträger (Firma / öffentliche Einrichtung) wählen";
  }
  if (billingTyp === "PRIVAT" && kostentraegerId) {
    fieldErrors.kostentraegerId = "Bei privat keine Kostenträger — sonst Billing-Typ wählen";
  }

  const kurs = kursId ? await db.orm.public.Kurs.where({ id: kursId }).first() : null;
  if (kursId && !kurs) return { error: "Kurs nicht gefunden." };
  const person = personId ? await db.orm.public.Person.where({ id: personId }).first() : null;
  if (personId && !person) return { error: "Person nicht gefunden." };
  if (rechnungsempfaengerId === personId) {
    fieldErrors.rechnungsempfaengerId = "Rechnungsempfänger muss abweichen (sonst leer lassen)";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  // Doppelte Anmeldung verhindern (Probe oder aktiv im selben Kurs).
  const bestehende = await db.orm.public.Anmeldung
    .where({ kursId, personId })
    .where((a) => a.status.in(["PROBE", "AKTIV"]))
    .first();
  if (bestehende) {
    return { error: "Diese Person ist in diesem Kurs bereits angemeldet (Status Probe oder aktiv)." };
  }

  // Tarif: automatisch nach Tageszeit des Kursstarts, Büro kann übersteuern.
  const tarifstufenRows = await db.orm.public.Tarifstufe.where({ active: true }).all();
  const tarifstufen: TarifstufeOption[] = tarifstufenRows.map((t) => ({
    id: t.id,
    name: t.name,
    lessonsPerPackage: t.lessonsPerPackage,
    middayFrom: t.middayFrom,
    middayTo: t.middayTo,
    eveningFrom: t.eveningFrom,
  }));
  if (tarifstufen.length === 0) return { error: "Keine aktiven Tarifstufen in den Stammdaten." };
  const auto = autoTarifstufe(kurs!.startZeit ?? "12:00", tarifstufen);
  const gewaehlte = tarifstufeId ? tarifstufen.find((t) => t.id === tarifstufeId) ?? null : auto;
  if (!gewaehlte) {
    return { error: "Tarifstufe nicht gefunden.", fieldErrors: { tarifstufeId: "Ungültig" } };
  }
  const tarifUebersteuert = Boolean(auto && gewaehlte.id !== auto.id);

  // Paketgrösse: Standard aus der Tarifstufe, übersteuerbar.
  const paketGroesse = paketRaw === "" ? gewaehlte.lessonsPerPackage : Number.parseInt(paketRaw, 10);
  if (!Number.isInteger(paketGroesse) || paketGroesse < 1 || paketGroesse > 60) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { paketGroesse: "Zahl zwischen 1 und 60" } };
  }
  const paketGroesseUebersteuert = paketGroesse !== gewaehlte.lessonsPerPackage;

  // Preis: Preisliste Kursart × Dauer × Tarifstufe, übersteuerbar (Abweichung dokumentieren).
  const listenpreis = await preislistenBetrag(kurs!.kursartId, kurs!.dauerMinuten, gewaehlte.id);
  let preisChf: string;
  let preisUebersteuert: boolean;
  if (preisRaw === "") {
    if (!listenpreis) {
      return {
        error: "Kein Preislisten-Preis für Kursart × Dauer × Tarifstufe erfasst — bitte Preis manuell angeben (mit Abweichungs-Grund).",
        fieldErrors: { preisChf: "Preis angeben" },
      };
    }
    preisChf = listenpreis;
    preisUebersteuert = false;
  } else {
    const betrag = Number.parseFloat(preisRaw.replace(",", "."));
    if (!Number.isFinite(betrag) || betrag < 0 || betrag > 99999) {
      return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { preisChf: "Ungültiger Betrag" } };
    }
    preisChf = betrag.toFixed(2);
    preisUebersteuert = !listenpreis || Number(listenpreis) !== betrag;
    if (preisUebersteuert && !preisAbweichungGrund) {
      return {
        error: "Abweichung vom Preislisten-Preis muss dokumentiert werden.",
        fieldErrors: { preisAbweichungGrund: "Pflicht bei Abweichung" },
      };
    }
  }

  let createdId: string | null = null;
  let erstellterHinweis = "";
  try {
    const created = await db.orm.public.Anmeldung.create({
      kursId,
      personId,
      status,
      billingTyp: billingTyp!,
      kostentraegerId,
      rechnungsempfaengerId,
      tarifstufeId: gewaehlte.id,
      tarifUebersteuert,
      paketGroesse,
      paketGroesseUebersteuert,
      preisChf,
      preisUebersteuert,
      preisAbweichungGrund: preisAbweichungGrund || null,
      paketStartAt: toDbTime(new Date()),
      paketEntscheid: "OFFEN",
      notizen,
    });

    // Feste Anmeldung: Paket-Guthaben sofort aufladen; Probe bleibt unverbraucht
    // (kein Guthaben/kein Preis — wandelt sich bei fester Anmeldung um).
    if (status === "AKTIV") {
      await db.orm.public.GuthabenJournal.create({
        anmeldungId: created.id,
        art: "AUFLADUNG",
        delta: paketGroesse,
        bemerkung: `Paket (${paketGroesse} Lektionen) bei Anmeldung`,
        actorUserId: actor.id,
        actorName: actor.name,
      });
    }

    await recordAudit({
      actor,
      action: "anmeldung.create",
      entity: "anmeldung",
      entityId: created.id,
      summary: `Anmeldung «${person!.vorname} ${person!.nachname}» in Kurs ${kurs!.code} (${status}, ${billingTyp})`,
      details: {
        tarifstufe: gewaehlte.name,
        tarifUebersteuert,
        paketGroesse,
        paketGroesseUebersteuert,
        preisChf,
        preisUebersteuert,
        preisAbweichungGrund: preisAbweichungGrund || null,
      },
    });

    // Modul 9: Rechnung bei fester Anmeldung automatisch (privat/Firma) —
    // öffentliche Einrichtungen rechnen im Nachhinein durchs Büro.
    let rechnungshinweis = "";
    if (status === "AKTIV") {
      rechnungshinweis = await erstellePaketRechnungFehlerTolerant(
        created.id,
        kurs!.code,
        "ANMELDUNG",
      );
      if (rechnungshinweis) {
        await recordAudit({
          actor,
          action: "rechnung.automatisch_erstellt",
          entity: "rechnung",
          summary: `Automatische Paket-Rechnung zur Anmeldung in ${kurs!.code}: ${rechnungshinweis}`,
        });
      }
    }

    revalidateAnmeldungen(`/anmeldungen/${created.id}`, `/kurse/${kursId}`, `/personen/${personId}`);
    createdId = created.id;
    erstellterHinweis = rechnungshinweis;
  } catch (error) {
    console.error("Anmeldung speichern fehlgeschlagen:", error);
    return { error: "Anmeldung konnte nicht gespeichert werden." };
  }

  // redirect() wirft — bewusst ausserhalb des try/catch (Muster Personen-Modul).
  if (createdId) redirect(`/anmeldungen/${createdId}`);
  return { success: `Anmeldung erfasst.${erstellterHinweis ? ` ${erstellterHinweis}` : ""}` };
}

// ——— Statuswechsel ————————————————————————————————————————————————

/** Probelektion wird zur festen Anmeldung: Paket-Guthaben wird aufgeladen. */
export async function probeZuAktivAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const anmeldung = await db.orm.public.Anmeldung
    .where({ id: anmeldungId })
    .include("person")
    .include("kurs")
    .first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };
  if (anmeldung.status !== "PROBE") return { error: "Nur Probe-Anmeldungen können aktiviert werden." };

  await db.orm.public.Anmeldung.where({ id: anmeldungId }).update({
    status: "AKTIV",
    paketStartAt: toDbTime(new Date()),
    paketEntscheid: "OFFEN",
  });
  await db.orm.public.GuthabenJournal.create({
    anmeldungId,
    art: "AUFLADUNG",
    delta: anmeldung.paketGroesse,
    bemerkung: `Paket (${anmeldung.paketGroesse} Lektionen) bei fester Anmeldung`,
    actorUserId: actor.id,
    actorName: actor.name,
  });
  await recordAudit({
    actor,
    action: "anmeldung.probe_zu_aktiv",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Probe-Anmeldung «${anmeldung.person.vorname} ${anmeldung.person.nachname}» in Kurs ${anmeldung.kurs.code} zur festen Anmeldung umgewandelt (+${anmeldung.paketGroesse} Lektionen)`,
  });

  // Modul 9: Rechnung bei fester Anmeldung automatisch (privat/Firma).
  const rechnungshinweis = await erstellePaketRechnungFehlerTolerant(anmeldungId, anmeldung.kurs.code, "ANMELDUNG");
  if (rechnungshinweis) {
    await recordAudit({
      actor,
      action: "rechnung.automatisch_erstellt",
      entity: "rechnung",
      summary: `Automatische Paket-Rechnung zur Anmeldung in ${anmeldung.kurs.code}: ${rechnungshinweis}`,
    });
  }

  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`, `/kurse/${anmeldung.kursId}`);
  return { success: `Anmeldung ist jetzt aktiv — Paket-Guthaben aufgeladen.${rechnungshinweis ? ` ${rechnungshinweis}` : ""}` };
}

export async function beendeAnmeldungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const anmeldung = await db.orm.public.Anmeldung
    .where({ id: anmeldungId })
    .include("person")
    .include("kurs")
    .first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };
  if (anmeldung.status === "BEENDET") return { error: "Die Anmeldung ist bereits beendet." };

  await db.orm.public.Anmeldung.where({ id: anmeldungId }).update({
    status: "BEENDET",
    paketEntscheid: "BEENDET",
  });
  await recordAudit({
    actor,
    action: "anmeldung.beenden",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Anmeldung «${anmeldung.person.vorname} ${anmeldung.person.nachname}» in Kurs ${anmeldung.kurs.code} beendet`,
  });
  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`, `/kurse/${anmeldung.kursId}`);
  return { success: "Anmeldung beendet." };
}

// ——— Guthaben-Konto (Aufladung, Korrektur, Fehlzeiten) —————————————

export async function ladeGuthabenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const anzahl = Number.parseInt(str(formData, "anzahl"), 10);
  const bemerkung = str(formData, "bemerkung") || null;
  if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > 60) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { anzahl: "1–60 Lektionen" } };
  }
  const anmeldung = await db.orm.public.Anmeldung.where({ id: anmeldungId }).first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };

  await db.orm.public.GuthabenJournal.create({
    anmeldungId,
    art: "AUFLADUNG",
    delta: anzahl,
    bemerkung: bemerkung ?? "Manuelle Aufladung durchs Büro",
    actorUserId: actor.id,
    actorName: actor.name,
  });
  await recordAudit({
    actor,
    action: "anmeldung.guthaben_aufgeladen",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Guthaben +${anzahl} Lektionen aufgeladen${bemerkung ? ` — ${bemerkung}` : ""}`,
  });
  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`);
  return { success: `+${anzahl} Lektionen aufgeladen.` };
}

export async function korrigiereGuthabenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const delta = Number.parseInt(str(formData, "delta"), 10);
  const bemerkung = str(formData, "bemerkung");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 20) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { delta: "Korrektur von −20 bis +20 (nicht 0)" } };
  }
  if (bemerkung.length < 3) {
    return { error: "Korrekturen müssen begründet werden.", fieldErrors: { bemerkung: "Mindestens 3 Zeichen" } };
  }
  const anmeldung = await db.orm.public.Anmeldung.where({ id: anmeldungId }).first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };

  await db.orm.public.GuthabenJournal.create({
    anmeldungId,
    art: "KORREKTUR",
    delta,
    bemerkung,
    actorUserId: actor.id,
    actorName: actor.name,
  });
  await recordAudit({
    actor,
    action: "anmeldung.guthaben_korrigiert",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Guthaben korrigiert (${delta > 0 ? "+" : ""}${delta}) — ${bemerkung}`,
  });
  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`);
  return { success: `Guthaben korrigiert (${delta > 0 ? "+" : ""}${delta}).` };
}

/**
 * Fehlzeit erfassen — das Büro entscheidet final (Pflichtenheft Modul 5):
 * unentschuldigt −1 Lektion, entschuldigt −0 (wird dokumentiert).
 */
export async function erfasseFehlzeitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const datumRaw = str(formData, "datum");
  const entschuldigt = str(formData, "entschuldigt") === "1";
  const bemerkung = str(formData, "bemerkung") || null;
  if (!parseDateKey(datumRaw)) {
    return { error: "Bitte ein gültiges Datum angeben.", fieldErrors: { datum: "TT.MM.JJJJ" } };
  }
  const anmeldung = await db.orm.public.Anmeldung.where({ id: anmeldungId }).first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };
  if (anmeldung.status !== "AKTIV") {
    return { error: "Fehlzeiten können nur bei aktiven Anmeldungen erfasst werden." };
  }

  await db.orm.public.GuthabenJournal.create({
    anmeldungId,
    art: entschuldigt ? "FEHLZEIT_ENTSCHULDIGT" : "FEHLZEIT_UNENTSCHULDIGT",
    delta: entschuldigt ? 0 : -1,
    datum: toDbTime(dateKeyToUtcMidnight(datumRaw)),
    bemerkung,
    actorUserId: actor.id,
    actorName: actor.name,
  });
  await recordAudit({
    actor,
    action: "anmeldung.fehlzeit",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Fehlzeit erfasst (${entschuldigt ? "entschuldigt, −0" : "unentschuldigt, −1"}) am ${datumRaw}${bemerkung ? ` — ${bemerkung}` : ""}`,
  });
  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`);
  return {
    success: entschuldigt
      ? "Entschuldigte Fehlzeit dokumentiert (kein Guthaben-Abzug)."
      : "Unentschuldigte Fehlzeit erfasst (−1 Lektion).",
  };
}

// ——— Paketende-Automatik ———————————————————————————————————————————

/**
 * Paket verlängern: Guthaben-Auffüllung um die Paketgrösse, neues Paket startet.
 * Bei privat/Firma geht die Rechnung automatisch raus (Modul 9 löst aus; hier
 * dokumentiert) — bei öffentlichen Einrichtungen nur Verlängerung im Nachhinein.
 */
export async function paketVerlaengernAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const anmeldung = await db.orm.public.Anmeldung
    .where({ id: anmeldungId })
    .include("person")
    .include("kurs")
    .first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };
  if (anmeldung.status !== "AKTIV") return { error: "Nur aktive Anmeldungen können verlängert werden." };

  const rechnungshinweis =
    anmeldung.billingTyp === "OEFFENTLICHE_EINRICHTUNG"
      ? "Behörde: Verlängerung ohne Vorausrechnung (Rechnung im Nachhinein, Modul 9)"
      : "";

  await db.transaction(async (tx) => {
    await tx.orm.public.GuthabenJournal.create({
      anmeldungId,
      art: "AUFLADUNG",
      delta: anmeldung.paketGroesse,
      bemerkung: `Paketverlängerung (${anmeldung.paketGroesse} Lektionen)`,
      actorUserId: actor.id,
      actorName: actor.name,
    });
    await tx.orm.public.Anmeldung.where({ id: anmeldungId }).update({
      paketStartAt: toDbTime(new Date()),
      paketEntscheid: "OFFEN",
      paketEndeGemeldetAt: null,
    });
  });

  await recordAudit({
    actor,
    action: "anmeldung.paket_verlaengert",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Paket verlängert (+${anmeldung.paketGroesse} Lektionen) für «${anmeldung.person.vorname} ${anmeldung.person.nachname}» in Kurs ${anmeldung.kurs.code}${rechnungshinweis ? ` — ${rechnungshinweis}` : ""}`,
    details: { billingTyp: anmeldung.billingTyp, preisChf: anmeldung.preisChf.toString() },
  });

  // Modul 9: Rechnung bei Paket-Verlängerung automatisch (privat/Firma —
  // Anschluss an die Paketende-Automatik aus Modul 5/7).
  const rechnungshinweisNeu = await erstellePaketRechnungFehlerTolerant(anmeldungId, anmeldung.kurs.code, "VERLAENGERUNG");
  if (rechnungshinweisNeu) {
    await recordAudit({
      actor,
      action: "rechnung.automatisch_erstellt",
      entity: "rechnung",
      summary: `Automatische Paket-Rechnung zur Verlängerung in ${anmeldung.kurs.code}: ${rechnungshinweisNeu}`,
    });
  }

  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`);
  const hinweis = rechnungshinweis || rechnungshinweisNeu || "Behörde-Rechnungen werden im Nachhinein durchs Büro erstellt.";
  return { success: `Paket verlängert (+${anmeldung.paketGroesse} Lektionen). ${hinweis}` };
}

/** Paketende: Anmeldung beenden (Entscheid «beenden»). */
export async function paketBeendenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return beendeAnmeldungAction(_prev, formData);
}

/**
 * Teilnehmende am Paketende informieren / erinnern («Fortfahren oder
 * beenden?»). Ohne SMTP wird in der Entwicklung in die Konsole geloggt.
 */
export async function paketErinnernAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireAnmeldeManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const anmeldungId = str(formData, "anmeldungId");
  const anmeldung = await db.orm.public.Anmeldung
    .where({ id: anmeldungId })
    .include("person")
    .include("kurs")
    .first();
  if (!anmeldung) return { error: "Anmeldung nicht gefunden." };

  const email = anmeldung.person.email;
  if (!email) {
    return { error: "Die Person hat keine E-Mail-Adresse — bitte telefonisch informieren." };
  }
  const rest = anmeldung.paketGroesse - (await verbrauchtImPaketDb(anmeldungId, anmeldung.paketStartAt));
  const ergebnis = await sendMail({
    to: email,
    subject: `Ihr Paket in ${anmeldung.kurs.code} läuft zu Ende`,
    text:
      `Hallo ${anmeldung.person.vorname} ${anmeldung.person.nachname}\n\n` +
      `Ihr aktuelles Paket (${anmeldung.paketGroesse} Lektionen) ist bald aufgebraucht: noch ${rest} Lektionen.\n` +
      `Möchten Sie fortfahren (nächste ${anmeldung.paketGroesse} Lektionen) oder beenden?\n` +
      `Bitte melden Sie sich im Büro der Sprachschule linguasud.\n`,
    html:
      `<p style="margin:0 0 8px;font-size:14px;">Hallo ${anmeldung.person.vorname} ${anmeldung.person.nachname},</p>` +
      `<p style="margin:0 0 8px;font-size:14px;">Ihr aktuelles Paket (${anmeldung.paketGroesse} Lektionen) ist bald aufgebraucht: noch <strong>${rest} Lektionen</strong>.</p>` +
      `<p style="margin:0 0 8px;font-size:14px;">Möchten Sie <strong>fortfahren</strong> (nächste ${anmeldung.paketGroesse} Lektionen) oder <strong>beenden</strong>?</p>` +
      `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Kurs: ${anmeldung.kurs.code} · Sprachschule linguasud</p>`,
  });
  if (!ergebnis.delivered && !ergebnis.devLogged) {
    return { error: `E-Mail konnte nicht versendet werden (${ergebnis.error ?? "unbekannter Fehler"}).` };
  }

  await db.orm.public.Anmeldung.where({ id: anmeldungId }).update({
    paketEndeGemeldetAt: toDbTime(new Date()),
  });

  // Automatische Büro-Aufgabe (Modul 13): Paket-Ende ohne Antwort nachverfolgen.
  // Dedup pro Anmeldung (dedupKey) — auch mehrfache Erinnerungen legen keine
  // zweite Aufgabe an.
  try {
    await erstelleAutomatischeAufgabe({
      quelle: "paketende",
      dedupKey: `paketende:${anmeldungId}`,
      titel: `Paket-Ende: Entscheidung von ${anmeldung.person.vorname} ${anmeldung.person.nachname} (${anmeldung.kurs.code}) offen`,
      beschreibung:
        "Teilnehmende(r) wurde am Paket-Ende informiert («fortfahren oder beenden?»). " +
        "Nach der Antwort: «fortfahren» lädt das neue Paket auf (Rechnung entsteht automatisch), «beenden» schliesst die Anmeldung.\n\n" +
        `Anmeldung: /anmeldungen/${anmeldungId}`,
      personId: anmeldung.personId,
      kursId: anmeldung.kursId,
      faelligAm: dateKeyToUtcMidnight(addDays(heuteDateKey(), 3)),
    });
  } catch (error) {
    console.error("Automatische Paket-Ende-Aufgabe fehlgeschlagen:", error);
  }

  await recordAudit({
    actor,
    action: "anmeldung.paketende_informiert",
    entity: "anmeldung",
    entityId: anmeldungId,
    summary: `Teilnehmende(r) «${anmeldung.person.vorname} ${anmeldung.person.nachname}» am Paketende informiert/erinnert (${ergebnis.devLogged ? "Dev-Log" : "E-Mail gesendet"})`,
  });
  revalidateAnmeldungen(`/anmeldungen/${anmeldungId}`);
  return { success: ergebnis.devLogged ? "Erinnerung wurde im Dev-Log ausgegeben (kein SMTP konfiguriert)." : "Erinnerung per E-Mail versendet." };
}

/** Verbrauchte Lektionen im laufenden Paket (Journal-Query + pure Logik). */
async function verbrauchtImPaketDb(anmeldungId: string, paketStartAt: string): Promise<number> {
  const journal = await db.orm.public.GuthabenJournal.where({ anmeldungId }).all();
  return verbrauchtImPaket(
    journal.map((j) => ({ art: j.art, delta: j.delta, datum: String(j.datum) })),
    paketStartAt,
  );
}

/**
 * Automatische Paket-Rechnung (Modul 9) — Fehler dürfen die Aufladung nicht
 * abbrechen: der Hinweis kommt in die Erfolgsmeldung, das Büro erstellt im
 * Fehlfall die Rechnung manuell. Behörden (öffentliche Einrichtungen) haben
 * bewusst keine Automatik-Rechnung (Rechnung im Nachhinein).
 */
async function erstellePaketRechnungFehlerTolerant(
  anmeldungId: string,
  kursCode: string,
  anlass: "ANMELDUNG" | "VERLAENGERUNG",
): Promise<string> {
  const anmeldung = await db.orm.public.Anmeldung.where({ id: anmeldungId }).first();
  if (!anmeldung || anmeldung.billingTyp === "OEFFENTLICHE_EINRICHTUNG") return "";
  try {
    const rechnung = await erstellePaketRechnung(
      {
        id: anmeldung.id,
        status: anmeldung.status,
        billingTyp: anmeldung.billingTyp,
        kostentraegerId: anmeldung.kostentraegerId,
        rechnungsempfaengerId: anmeldung.rechnungsempfaengerId,
        personId: anmeldung.personId,
        paketGroesse: anmeldung.paketGroesse,
        preisChf: String(anmeldung.preisChf),
      },
      kursCode,
      anlass,
    );
    if (!rechnung) {
      return "Hinweis: Keine automatische Rechnung möglich (Kostenträger fehlt) — bitte manuell erstellen.";
    }
    return `Rechnung ${rechnung.nummer} (Entwurf, ${Number(rechnung.totalChf).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF) wurde automatisch erstellt.`;
  } catch (error) {
    console.error("Automatische Paket-Rechnung fehlgeschlagen:", error);
    return "Hinweis: Automatische Rechnung fehlgeschlagen — bitte in den Rechnungen manuell erstellen.";
  }
}
