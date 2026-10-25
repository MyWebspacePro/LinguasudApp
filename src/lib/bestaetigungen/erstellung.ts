import "server-only";

// Erzeugung der Kursbestätigungen (Modul 10). Kernlogik für beide Wege:
// automatisch beim Niveau-Wechsel (alle aktiven Teilnehmenden des so
// abgeschlossenen Abschnitts) und manuell durchs Büro (jederzeit, auch für
// beendete Anmeldungen und den laufenden Abschnitt — Zeitraum bis heute).
// Pro Person und Niveau-Abschnitt gibt es genau eine Bestätigung
// (Unique-Constraint); erneutes Erzeugen aktualisiert die Snapshots.

import { db, fromDbTime, toDbTime } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { dateKeyOf, dateKeyToUtcMidnight, heuteDateKey } from "@/lib/zeit";
import { zeitraumText, zaehleBesuchteLektionen } from "./logik";

export interface ErzeugungsActor {
  id: string;
  email: string;
  name: string;
}

export interface BestaetigungsErgebnis {
  verlaufId: string;
  kursId: string;
  kursCode: string;
  niveauCode: string;
  vonKey: string;
  bisKey: string;
  /** Anzahl neu erstellter bzw. aktualisierter Bestätigungen. */
  erstellt: number;
  aktualisiert: number;
  /** Namen der Empfangenden (für Erfolgsmeldungen). */
  personen: string[];
}

/**
 * Erzeugt/aktualisiert die Kursbestätigungen für einen Niveau-Abschnitt.
 * «Besuchte Lektionen» = Anwesenheit ANWESEND der Person in
 * DURCHGEFUEHRTen Lektionen des Kurses mit Lokaltag im Abschnitts-Zeitraum.
 */
export async function erzeugeBestaetigungenFuerAbschnitt(opts: {
  verlaufId: string;
  ausloeser: "NIVEAU_WECHSEL" | "MANUELL";
  actor: ErzeugungsActor;
  /**
   * Für welche Anmeldung-Statusses erzeugt wird. Default: nur AKTIV beim
   * automatischen Niveau-Wechsel, AKTIV + BEENDET bei manueller Erzeugung.
   */
  statusse?: ReadonlyArray<"AKTIV" | "BEENDET">;
}): Promise<BestaetigungsErgebnis> {
  const verlauf = await db.orm.public.KursNiveauVerlauf.where({ id: opts.verlaufId }).first();
  if (!verlauf) throw new Error("Niveau-Abschnitt nicht gefunden.");

  const kurs = await db.orm.public.Kurs
    .where({ id: verlauf.kursId })
    .include("sprache")
    .include("kursart")
    .first();
  if (!kurs) throw new Error("Kurs nicht gefunden.");
  const niveau = await db.orm.public.Niveau.where({ id: verlauf.niveauId }).first();
  if (!niveau) throw new Error("Niveau nicht gefunden.");

  // Zeitraum des Abschnitts; beim laufenden Abschnitt (bis = null) endet der
  // bestätigte Zeitraum am heutigen Tag.
  const vonKey = dateKeyOf(fromDbTime(verlauf.von));
  const bisKey = verlauf.bis ? dateKeyOf(fromDbTime(verlauf.bis)) : heuteDateKey();

  const statusse = opts.statusse ?? (opts.ausloeser === "NIVEAU_WECHSEL" ? (["AKTIV"] as const) : (["AKTIV", "BEENDET"] as const));

  const [lektionen, anmeldungen] = await Promise.all([
    db.orm.public.Lektion
      .where({ kursId: kurs.id, status: "DURCHGEFUEHRT" })
      .all(),
    db.orm.public.Anmeldung
      .where({ kursId: kurs.id })
      .where((a) => a.status.in([...statusse]))
      .include("person")
      .all(),
  ]);

  const lektionIds = lektionen.map((l) => l.id);
  const anwesenheiten = lektionIds.length
    ? await db.orm.public.Anwesenheit
        .where({ status: "ANWESEND" })
        .where((a) => a.lektionId.in(lektionIds))
        .all()
    : [];

  const besuchte = zaehleBesuchteLektionen(lektionen, anwesenheiten, vonKey, bisKey);
  const ausstellungsdatum = toDbTime(dateKeyToUtcMidnight(heuteDateKey()));

  let erstellt = 0;
  let aktualisiert = 0;
  const personen: string[] = [];

  for (const anmeldung of anmeldungen) {
    const person = anmeldung.person;
    const personName = `${person.vorname} ${person.nachname}`;
    const snapshot = {
      personAnrede: person.anrede,
      personName,
      spracheName: kurs.sprache.name,
      niveauCode: niveau.code,
      niveauName: niveau.name,
      kursartName: kurs.kursart.name,
      kursCode: kurs.code,
      zeitraumVon: verlauf.von,
      zeitraumBis: toDbTime(dateKeyToUtcMidnight(bisKey)),
      besuchteLektionen: besuchte.get(anmeldung.id) ?? 0,
      ausstellungsdatum,
      ausgestelltVonName: opts.actor.name,
      ausloeser: opts.ausloeser,
    };

    const bestehende = await db.orm.public.Kursbestaetigung
      .where({ personId: person.id, verlaufId: verlauf.id })
      .first();
    if (bestehende) {
      await db.orm.public.Kursbestaetigung.where({ id: bestehende.id }).update(snapshot);
      aktualisiert++;
    } else {
      await db.orm.public.Kursbestaetigung.create({
        personId: person.id,
        kursId: kurs.id,
        verlaufId: verlauf.id,
        anmeldungId: anmeldung.id,
        ...snapshot,
      });
      erstellt++;
    }
    personen.push(personName);
  }

  await recordAudit({
    actor: opts.actor,
    action: opts.ausloeser === "NIVEAU_WECHSEL" ? "bestaetigung.auto_erzeugt" : "bestaetigung.manuell_erzeugt",
    entity: "kursbestaetigung",
    entityId: verlauf.id,
    summary:
      `Kursbestätigungen Niveau ${niveau.code} (${zeitraumText(vonKey, bisKey)}) für Kurs «${kurs.code}»: ` +
      `${erstellt} neu, ${aktualisiert} aktualisiert`,
    details: { verlaufId: verlauf.id, kursId: kurs.id, personen, von: vonKey, bis: bisKey },
  });

  return {
    verlaufId: verlauf.id,
    kursId: kurs.id,
    kursCode: kurs.code,
    niveauCode: niveau.code,
    vonKey,
    bisKey,
    erstellt,
    aktualisiert,
    personen,
  };
}
