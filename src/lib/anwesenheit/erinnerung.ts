import "server-only";

// Automatische Erinnerung (Modul 7): am nächsten Tag an die Lehrperson,
// wenn die Anwesenheit einer vergangenen Lektion noch offen ist. Läuft im
// nächtlichen Rhythmus (Marker in SystemSetting, siehe erinnerungsjob.ts);
// jede Lektion wird nur einmal erinnert (anwesenheitErinnertAt).

import { db, toDbTime } from "@/lib/db";
import { fromDbTime } from "@/lib/domain";
import { recordAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { formatDatumKurz, heuteDateKey, timeFromMinutes, utcToZoned } from "@/lib/zeit";
import { lektionsEndeDateKey } from "./logik";

const MARKER_KEY = "anwesenheit.erinnertAm";

/** Nächtlicher Marker: wurde heute (Schul-Zeitzone) schon erinnert? */
export async function istHeuteNochNichtErinnert(heuteKey: string = heuteDateKey()): Promise<boolean> {
  const marker = await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).first();
  return marker?.value !== heuteKey;
}

export async function markiereErinnerung(heuteKey: string = heuteDateKey()): Promise<void> {
  const marker = await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).first();
  if (marker) {
    await db.orm.public.SystemSetting.where({ key: MARKER_KEY }).update({ value: heuteKey });
  } else {
    await db.orm.public.SystemSetting.create({ key: MARKER_KEY, value: heuteKey });
  }
}

export interface ErinnerungsResultat {
  /** Lektionen, für die heute erstmals erinnert wurde. */
  erinnert: number;
  /** Lehrpersonen ohne E-Mail (können nicht informiert werden). */
  ohneEmail: number;
}

/**
 * Erinnert die Lehrpersonen aller offenen Anwesenheiten (Lektion beendet,
 * noch nicht durchgeführt/abgesagt, noch nie erinnert — Ende-Tag vor heute).
 * Lektionen von heute sind ausdrücklich ausgenommen (24-h-Fenster läuft).
 */
export async function erinnereOffeneAnwesenheiten(heuteKey: string = heuteDateKey()): Promise<ErinnerungsResultat> {
  // Kandidaten: beendete (Ende vorbei) Lektionen, offen, noch nicht erinnert.
  // Grosszügig rückwärts (Horizont der Generierung + Puffer).
  const untergrenze = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const lektionen = await db.orm.public.Lektion
    .where((l) => l.status.in(["PROVISORISCH", "FIXIERT"]))
    .where((l) => l.startAt.gte(toDbTime(untergrenze)))
    .where((l) => l.anwesenheitErinnertAt.isNull())
    .include("kurs")
    .include("lehrperson")
    .all();

  // Nur Lektionen, deren Ende-Tag vor heute liegt (nach der Lektion, 24-h-Fenster).
  const offen = lektionen.filter((l) => lektionsEndeDateKey(l.startAt, l.dauerMinuten) < heuteKey);

  // Nach Lehrperson gruppieren.
  const nachLehrperson = new Map<string, typeof offen>();
  let ohneEmail = 0;
  for (const lektion of offen) {
    if (!lektion.lehrperson) {
      ohneEmail++;
      continue;
    }
    const liste = nachLehrperson.get(lektion.lehrperson.id) ?? [];
    liste.push(lektion);
    nachLehrperson.set(lektion.lehrperson.id, liste);
  }

  let erinnert = 0;
  for (const [personId, liste] of nachLehrperson) {
    const lehrperson = liste[0].lehrperson!;
    const email = lehrperson.email;
    if (!email) {
      ohneEmail++;
      continue;
    }
    const zeilen = liste
      .map((l) => {
        const local = utcToZoned(fromDbTime(l.startAt));
        const ende = timeFromMinutes(local.minuteOfDay + l.dauerMinuten);
        return `• ${formatDatumKurz(local.dateKey)} ${timeFromMinutes(local.minuteOfDay)}–${ende} · ${l.kurs.code}`;
      })
      .join("\n");
    const zeilenHtml = liste
      .map((l) => {
        const local = utcToZoned(fromDbTime(l.startAt));
        const ende = timeFromMinutes(local.minuteOfDay + l.dauerMinuten);
        return `<li style="margin:0 0 4px;">${formatDatumKurz(local.dateKey)} ${timeFromMinutes(local.minuteOfDay)}–${ende} · ${l.kurs.code}</li>`;
      })
      .join("");

    const ergebnis = await sendMail({
      to: email,
      subject: "Erinnerung: Anwesenheit erfassen",
      text:
        `Hallo ${lehrperson.vorname} ${lehrperson.nachname}\n\n` +
        `Für die folgenden Lektionen ist die Anwesenheit noch offen. Bitte erfassen Sie sie ` +
        `im Raumplaner (Klick auf die Lektion) — innerhalb von 24 Stunden nach der Lektion:\n\n${zeilen}\n\n` +
        `Sprachschule linguasud\n`,
      html:
        `<p style="margin:0 0 8px;font-size:14px;">Hallo ${lehrperson.vorname} ${lehrperson.nachname},</p>` +
        `<p style="margin:0 0 8px;font-size:14px;">Für die folgenden Lektionen ist die Anwesenheit noch offen. ` +
        `Bitte erfassen Sie sie im Raumplaner (Klick auf die Lektion) — innerhalb von 24 Stunden nach der Lektion:</p>` +
        `<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;">${zeilenHtml}</ul>` +
        `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Sprachschule linguasud</p>`,
    });
    if (ergebnis.delivered || ergebnis.devLogged) {
      const jetzt = new Date();
      for (const lektion of liste) {
        await db.orm.public.Lektion.where({ id: lektion.id }).update({
          anwesenheitErinnertAt: jetzt.toISOString(),
        });
        erinnert++;
      }
      await recordAudit({
        actor: null,
        action: "anwesenheit.erinnerung",
        entity: "person",
        entityId: personId,
        summary: `Anwesenheits-Erinnerung an ${lehrperson.vorname} ${lehrperson.nachname}: ${liste.length} offene Lektion(en) (${ergebnis.devLogged ? "Dev-Log" : "E-Mail gesendet"})`,
        details: { lektionen: liste.map((l) => l.id) },
      });
    }
  }

  return { erinnert, ohneEmail };
}

/**
 * Nächtlicher Job-Aufruf: erinnert nur, wenn heute noch nicht erinnert wurde
 * (Marker + Datum in der Schul-Zeitzone).
 */
export async function naechtlicherErinnerungsLauf(): Promise<void> {
  const heuteKey = heuteDateKey();
  if (!(await istHeuteNochNichtErinnert(heuteKey))) return;
  await markiereErinnerung(heuteKey);
  const result = await erinnereOffeneAnwesenheiten(heuteKey);
  if (result.erinnert > 0 || result.ohneEmail > 0) {
    console.log(
      `Anwesenheits-Erinnerung: ${result.erinnert} Lektion(en) erinnert${result.ohneEmail ? `, ${result.ohneEmail} ohne E-Mail` : ""}.`,
    );
  }
}
