"use server";

// Rechnungs-Server-Actions (Modul 9): Rechnungen anlegen (manuell durchs
// Büro — auch Behörden im Nachhinein), Entwurf pflegen, versenden (PDF +
// E-Mail), Teilzahlungen erfassen (Restbetrag → Status), stornieren,
// Mahn-Stufe manuell versenden. Pflege: Admin/Chef/Büro. Alles Audit.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, toDbTime, type Role } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { sendMail } from "@/lib/mail";
import {
  berechneSumme,
  betragString,
  RECHNUNG_STATUS_LABELS,
  restbetrag,
} from "./logik";
import { erstelleRechnung, type PositionInput } from "./erstellung";
import { ladeRechnungsPdf } from "./druck";
import { versendeMahnung } from "./mahnung";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function roleListOf(ctx: { user: { roles: unknown } }): Role[] {
  return ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
}

async function requireRechnungsManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageAnmeldungen(roleListOf(ctx))) {
    return { failure: { error: "Die Rechnungsverwaltung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidateRechnungen(...paths: string[]) {
  revalidatePath("/rechnungen");
  revalidatePath("/dashboard");
  for (const p of paths) revalidatePath(p);
}

/** Positionen aus dem Formular lesen (text/menge/preis als nummerierte Felder). */
function lesePositionen(formData: FormData): PositionInput[] {
  const positionen: PositionInput[] = [];
  for (let i = 0; i < 20; i++) {
    const text = str(formData, `positionText${i}`);
    if (!text) continue;
    const menge = Number.parseInt(str(formData, `positionMenge${i}`) || "1", 10);
    const einzelpreisChf = str(formData, `positionPreis${i}`).replace(",", ".");
    positionen.push({ text, menge, einzelpreisChf });
  }
  return positionen;
}

function leseMwst(formData: FormData): number | null {
  const raw = str(formData, "mwstSatzProzent").replace(",", ".");
  if (raw === "") return null;
  const satz = Number(raw);
  return Number.isFinite(satz) && satz >= 0 && satz <= 20 ? satz : null;
}

// ——— Rechnung anlegen (manuell; Behörden im Nachhinein durchs Büro) ————

export async function erstelleRechnungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  // Das Empfänger-Feld trägt "person:<id>" bzw. "kostentraeger:<id>" (eine Auswahl).
  const rohEmpfaenger = str(formData, "empfaengerId");
  const [empfaengerTyp, ...idTeile] = rohEmpfaenger.split(":");
  const empfaengerId = idTeile.join(":");
  const notiz = str(formData, "notiz") || null;

  const fieldErrors: Record<string, string> = {};
  if (empfaengerTyp !== "person" && empfaengerTyp !== "kostentraeger") {
    fieldErrors.empfaengerId = "Empfänger wählen";
  }
  if (!empfaengerId) fieldErrors.empfaengerId = "Pflichtfeld";
  const positionen = lesePositionen(formData);
  if (positionen.length === 0) fieldErrors.positionen = "Mindestens eine Position (Text + Betrag)";
  const mwst = leseMwst(formData);
  if (mwst === null && str(formData, "mwstSatzProzent") !== "") {
    fieldErrors.mwstSatzProzent = "0–20 %";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  let erstelltId: string | null = null;
  try {
    const empfaenger = await baueEmpfaenger(empfaengerTyp, empfaengerId);
    if (!empfaenger) {
      return { error: "Empfänger nicht gefunden.", fieldErrors: { empfaengerId: "Ungültig" } };
    }

    const created = await erstelleRechnung({
      empfaenger,
      positionen,
      mwstSatzProzent: mwst,
      notiz,
    });

    await recordAudit({
      actor,
      action: "rechnung.create",
      entity: "rechnung",
      entityId: created.id,
      summary: `Rechnung ${created.nummer} erstellt (${empfaenger.name}, ${created.totalChf} CHF)`,
      details: { positionen: positionen.length, totalChf: created.totalChf, referenzNr: created.referenzNr },
    });
    revalidateRechnungen(`/rechnungen/${created.id}`);
    erstelltId = created.id;
  } catch (error) {
    console.error("Rechnung erstellen fehlgeschlagen:", error);
    return { error: error instanceof Error ? error.message : "Rechnung konnte nicht erstellt werden." };
  }

  // redirect() wirft — bewusst ausserhalb des try/catch (Muster Personen-Modul).
  if (erstelltId) redirect(`/rechnungen/${erstelltId}`);
  return { success: "Rechnung erstellt." };
}

async function baueEmpfaenger(typ: string, id: string) {
  if (typ === "person") {
    const person = await db.orm.public.Person.where({ id }).first();
    if (!person) return null;
    const rechnungsadresse = person.rechnungStrasse || person.rechnungPlz || person.rechnungOrt;
    return {
      personId: person.id,
      kostentraegerId: null,
      name: `${person.vorname} ${person.nachname}`,
      strasse: (rechnungsadresse ? person.rechnungStrasse : person.strasse) ?? "",
      plz: (rechnungsadresse ? person.rechnungPlz : person.plz) ?? "",
      ort: (rechnungsadresse ? person.rechnungOrt : person.ort) ?? "",
      land: "CH",
      email: person.email,
    };
  }
  const kt = await db.orm.public.Kostentraeger.where({ id }).first();
  if (!kt) return null;
  return {
    personId: null,
    kostentraegerId: kt.id,
    name: kt.name,
    strasse: kt.strasse,
    plz: kt.plz,
    ort: kt.ort,
    land: "CH",
    email: null,
  };
}

// ——— Entwurf pflegen ————————————————————————————————————————

export async function updateEntwurfAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status !== "ENTWURF") {
    return { error: "Nur Entwürfe lassen sich bearbeiten — versendete Rechnungen sind unveränderlich." };
  }

  const positionen = lesePositionen(formData);
  const mwst = leseMwst(formData);
  const notiz = str(formData, "notiz") || null;
  const zahlungsfristTageRaw = Number.parseInt(str(formData, "zahlungsfristTage") || "30", 10);
  if (positionen.length === 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { positionen: "Mindestens eine Position" } };
  }
  if (!Number.isInteger(zahlungsfristTageRaw) || zahlungsfristTageRaw < 1 || zahlungsfristTageRaw > 365) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { zahlungsfristTage: "1–365 Tage" } };
  }
  const summe = berechneSumme(positionen, mwst);

  await db.transaction(async (tx) => {
    await tx.orm.public.RechnungsPosition.where({ rechnungId }).delete();
    for (const [index, position] of positionen.entries()) {
      await tx.orm.public.RechnungsPosition.create({
        rechnungId,
        text: position.text.trim(),
        menge: position.menge,
        einzelpreisChf: position.einzelpreisChf,
        reihenfolge: index,
      });
    }
    // Fälligkeit neu berechnen: Frist ab heute (Entwurf ist noch nicht versendet).
    const faellig = new Date();
    faellig.setUTCDate(faellig.getUTCDate() + zahlungsfristTageRaw);
    faellig.setUTCHours(0, 0, 0, 0);
    await tx.orm.public.Rechnung.where({ id: rechnungId }).update({
      betragChf: summe.betragChf,
      mwstSatzProzent: mwst === null ? null : mwst.toFixed(2),
      totalChf: summe.totalChf,
      faelligAm: toDbTime(faellig),
      notiz,
    });
  });

  await recordAudit({
    actor,
    action: "rechnung.entwurf_bearbeitet",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Rechnung ${rechnung.nummer} bearbeitet (${positionen.length} Positionen, Total ${summe.totalChf} CHF)`,
  });
  revalidateRechnungen(`/rechnungen/${rechnungId}`);
  return { success: "Entwurf gespeichert." };
}

export async function loescheEntwurfAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status !== "ENTWURF") return { error: "Nur Entwürfe können gelöscht werden." };

  await db.orm.public.Rechnung.where({ id: rechnungId }).delete();
  await recordAudit({
    actor,
    action: "rechnung.entwurf_geloescht",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Rechnungs-Entwurf ${rechnung.nummer} gelöscht`,
  });
  revalidatePath("/rechnungen");
  redirect("/rechnungen");
}

// ——— Versenden / Stornieren ————————————————————————————————————

/** Entwurf → versendet: PDF als E-Mail-Anhang (falls E-Mail vorhanden). */
export async function versendeRechnungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status !== "ENTWURF") return { error: "Nur Entwürfe können versendet werden." };

  let versandHinweis = "";
  if (rechnung.empfaengerEmail) {
    try {
      const pdf = await ladeRechnungsPdf(rechnungId);
      const ergebnis = await sendMail({
        to: rechnung.empfaengerEmail,
        subject: `Rechnung ${rechnung.nummer} — Sprachschule linguasud`,
        text:
          `Guten Tag\n\nIm Anhang erhalten Sie die Rechnung ${rechnung.nummer} über ${rechnung.totalChf} CHF.\n` +
          `Referenznummer: ${rechnung.referenzNr}\n\nFreundliche Grüsse\nSprachschule linguasud\n`,
        html:
          `<p style="margin:0 0 8px;font-size:14px;">Guten Tag</p>` +
          `<p style="margin:0 0 8px;font-size:14px;">Im Anhang erhalten Sie die Rechnung <strong>${rechnung.nummer}</strong> über <strong>${Number(rechnung.totalChf).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF</strong>.</p>` +
          `<p style="margin:0 0 8px;font-size:14px;">Sie enthält einen scannbaren QR-Zahlteil (Referenz ${rechnung.referenzNr}).</p>` +
          `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Freundliche Grüsse · Sprachschule linguasud</p>`,
        attachments: [
          {
            filename: `Rechnung-${rechnung.nummer}.pdf`,
            content: Buffer.from(pdf.bytes),
          },
        ],
      });
      versandHinweis = ergebnis.devLogged
        ? " (E-Mail im Dev-Log ausgegeben)"
        : ergebnis.delivered
          ? " (E-Mail mit PDF versendet)"
          : ` (E-Mail fehlgeschlagen: ${ergebnis.error ?? "unbekannt"} — PDF druckbar)`;
    } catch (error) {
      console.error("Rechnungs-PDF für Versand fehlgeschlagen:", error);
      versandHinweis = " (PDF-Erzeugung fehlgeschlagen — Rechnung trotzdem als versendet markiert)";
    }
  } else {
    versandHinweis = " (keine E-Mail-Adresse hinterlegt — PDF drucken)";
  }

  await db.orm.public.Rechnung.where({ id: rechnungId }).update({
    status: "VERSENDET",
    versendetAt: toDbTime(new Date()),
  });
  await recordAudit({
    actor,
    action: "rechnung.versendet",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Rechnung ${rechnung.nummer} versendet an ${rechnung.empfaengerName}${versandHinweis}`,
  });
  revalidateRechnungen(`/rechnungen/${rechnungId}`);
  return { success: `Rechnung ${rechnung.nummer} ist versendet.${versandHinweis}` };
}

export async function storniereRechnungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const grund = str(formData, "grund");
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status === "STORNIERT") return { error: "Die Rechnung ist bereits storniert." };
  if (rechnung.status === "BEZAHLT") return { error: "Bezahlte Rechnungen werden nicht storniert." };
  if (grund.length < 3) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { grund: "Storno-Grund (min. 3 Zeichen)" } };
  }

  await db.orm.public.Rechnung.where({ id: rechnungId }).update({
    status: "STORNIERT",
    storniertAt: toDbTime(new Date()),
    storniertGrund: grund,
  });
  await recordAudit({
    actor,
    action: "rechnung.storniert",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Rechnung ${rechnung.nummer} storniert — ${grund}`,
  });
  revalidateRechnungen(`/rechnungen/${rechnungId}`);
  return { success: "Rechnung storniert." };
}

// ——— Zahlungen (Teil- und Vollzahlung) ————————————————————————

export async function erfasseZahlungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const betragRaw = str(formData, "betragChf").replace(",", ".");
  const bemerkung = str(formData, "bemerkung") || null;
  const betrag = Number(betragRaw);
  if (!Number.isFinite(betrag) || betrag <= 0 || betrag > 999_999) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors: { betragChf: "Betrag > 0" } };
  }

  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status === "STORNIERT") return { error: "Stornierte Rechnungen nehmen keine Zahlungen mehr entgegen." };
  if (rechnung.status === "ENTWURF") return { error: "Zahlungen erst nach dem Versenden erfassen." };
  if (rechnung.status === "BEZAHLT") return { error: "Die Rechnung ist bereits vollständig bezahlt." };

  const zahlungen = await db.orm.public.Zahlung.where({ rechnungId }).all();
  const total = String(rechnung.totalChf);
  const rest = restbetrag(
    total,
    zahlungen.map((z) => String(z.betragChf)),
  );
  if (betrag > Number(rest) + 0.005) {
    return {
      error: `Betrag übersteigt den Restbetrag (${Number(rest).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF).`,
      fieldErrors: { betragChf: "Max. Restbetrag" },
    };
  }

  await db.orm.public.Zahlung.create({
    rechnungId,
    betragChf: betragString(betrag),
    bemerkung,
    actorUserId: actor.id,
    actorName: actor.name,
  });

  const neuerRest = restbetrag(total, [...zahlungen.map((z) => String(z.betragChf)), betragString(betrag)]);
  const neuerStatus = Number(neuerRest) <= 0.005 ? "BEZAHLT" : "TEILBEZAHLT";
  await db.orm.public.Rechnung.where({ id: rechnungId }).update({ status: neuerStatus });

  await recordAudit({
    actor,
    action: "rechnung.zahlung_erfasst",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Zahlung ${betrag.toFixed(2)} CHF auf Rechnung ${rechnung.nummer} erfasst — Restbetrag ${neuerRest} CHF, Status ${RECHNUNG_STATUS_LABELS[neuerStatus as "TEILBEZAHLT" | "BEZAHLT"]}`,
    details: { betragChf: betragString(betrag), restChf: neuerRest, status: neuerStatus },
  });
  revalidateRechnungen(`/rechnungen/${rechnungId}`);
  return {
    success:
      neuerStatus === "BEZAHLT"
        ? "Zahlung erfasst — Rechnung ist vollständig bezahlt."
        : `Teilzahlung erfasst — Restbetrag ${Number(neuerRest).toLocaleString("de-CH", { minimumFractionDigits: 2 })} CHF.`,
  };
}

// ——— Mahnungen (manuell; automatisch läuft der Mahn-Job) ————————

/** Nächste Mahn-Stufe sofort versenden (freundliche Erinnerung / Mahnung). */
export async function sendeMahnungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireRechnungsManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const rechnungId = str(formData, "rechnungId");
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { error: "Rechnung nicht gefunden." };
  if (rechnung.status !== "VERSENDET" && rechnung.status !== "TEILBEZAHLT") {
    return { error: "Mahnungen gehen nur an versendete, unbezahlte Rechnungen." };
  }
  if (rechnung.mahnStufe >= 2) {
    return { error: "Beide Mahn-Stufen wurden bereits versendet." };
  }

  // Manuell darf das Büro eine Stufe auch vor dem Fristablauf auslösen;
  // automatisch versendet der Mahn-Job erst nach den Fristen.
  const stufe: 1 | 2 = rechnung.mahnStufe < 1 ? 1 : 2;
  const ergebnis = await versendeMahnung(rechnungId, stufe);
  await recordAudit({
    actor,
    action: "rechnung.mahnung_versendet",
    entity: "rechnung",
    entityId: rechnungId,
    summary: `Mahnung Stufe ${stufe} für ${rechnung.nummer} versendet${ergebnis.hinweis} (manuell durchs Büro)`,
  });
  revalidateRechnungen(`/rechnungen/${rechnungId}`);
  return { success: `Mahn-Stufe ${stufe} versendet${ergebnis.hinweis}.` };
}
