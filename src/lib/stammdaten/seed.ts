import "server-only";

import { db } from "@/lib/db";

/**
 * Startdaten für Modul 2 (Pflichtenheft): Standorte/Räume, Sprachen, Niveaus,
 * Kursarten, Lektionsdauern, Tarifstufen. Läuft einmalig beim Serverstart
 * (instrumentation) — der Seed-Marker in SystemSetting verhindert Wiederholung.
 *
 * Raumnamen + Sitzplätze sind Platzhalter (offener Punkt im Pflichtenheft:
 * erfassen wir gemeinsam im Setup) und lassen sich jederzeit bearbeiten.
 */

const START_STANDORTE = [
  {
    name: "Vorstadt 18",
    strasse: "Vorstadt 18",
    plz: "8200",
    ort: "Schaffhausen",
    etagen: [
      { name: "1. Stock", raeume: 3 },
      { name: "2. Stock", raeume: 5 },
      { name: "4. Stock", raeume: 3 },
    ],
  },
  {
    name: "Stadthausgasse 16",
    strasse: "Stadthausgasse 16",
    plz: "8200",
    ort: "Schaffhausen",
    etagen: [{ name: "1. Stock", raeume: 3 }],
  },
  {
    name: "Bahnhofplatz 9",
    strasse: "Bahnhofplatz 9",
    plz: "8400",
    ort: "Winterthur",
    etagen: [{ name: "1. Stock", raeume: 3 }],
  },
] as const;

const START_SPRACHEN = [
  { name: "Deutsch", code: "DE" },
  { name: "Englisch", code: "EN" },
  { name: "Italienisch", code: "IT" },
  { name: "Französisch", code: "FR" },
  { name: "Spanisch", code: "ES" },
] as const;

const START_NIVEAUS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const START_KURSARTEN = [
  { name: "Einzel", maxParticipants: 1, requiresRoom: true },
  { name: "2er", maxParticipants: 2, requiresRoom: true },
  { name: "3er", maxParticipants: 3, requiresRoom: true },
  { name: "4er", maxParticipants: 4, requiresRoom: true },
  { name: "6er", maxParticipants: 6, requiresRoom: true },
  { name: "Online", maxParticipants: 6, requiresRoom: false },
  { name: "Firmenkurs", maxParticipants: null, requiresRoom: true },
] as const;

const START_DAUERN = [45, 60, 90] as const;

// Zeitfenster-Defaults für die Standard-Ableitung nach Tageszeit — anpassbar.
const START_TARIFSTUFEN = [
  {
    name: "Hochtarif",
    lessonsPerPackage: 14,
    middayFrom: "11:30",
    middayTo: "13:30",
    eveningFrom: "17:00",
  },
  { name: "Niedertarif", lessonsPerPackage: 15, middayFrom: null, middayTo: null, eveningFrom: null },
] as const;

const SEED_MARKER = "stammdaten.startdaten";

export async function seedStartdaten(): Promise<void> {
  try {
    const marker = await db.orm.public.SystemSetting.where({ key: SEED_MARKER }).first();
    if (marker) return;

    const standortCount = await db.orm.public.Standort.aggregate((a) => ({ n: a.count() }));
    if (standortCount.n > 0) {
      // Manuell vorbefüllt — nichts säen, aber merken, damit wir nie erneut prüfen.
      await db.orm.public.SystemSetting.create({
        key: SEED_MARKER,
        value: new Date().toISOString(),
      });
      return;
    }

    await db.transaction(async (tx) => {
      // Hierarchie Standort → Etage → Raum explizit (keine verschachtelten Writes).
      for (const standort of START_STANDORTE) {
        const s = await tx.orm.public.Standort.create({
          name: standort.name,
          strasse: standort.strasse,
          plz: standort.plz,
          ort: standort.ort,
        });
        for (const [etageIndex, etage] of standort.etagen.entries()) {
          const e = await tx.orm.public.Etage.create({
            standortId: s.id,
            name: etage.name,
            sortOrder: etageIndex,
          });
          for (let i = 0; i < etage.raeume; i++) {
            await tx.orm.public.Raum.create({
              etageId: e.id,
              // Platzhalter bis die echten Raumnamen erfasst sind.
              name: `Raum ${etageIndex + 1}.${String(i + 1).padStart(2, "0")}`,
              seats: 0,
            });
          }
        }
      }

      for (const sprache of START_SPRACHEN) {
        await tx.orm.public.Sprache.create({ name: sprache.name, code: sprache.code });
      }
      for (const [i, code] of START_NIVEAUS.entries()) {
        await tx.orm.public.Niveau.create({ code, sortOrder: i + 1 });
      }
      for (const [i, kursart] of START_KURSARTEN.entries()) {
        await tx.orm.public.Kursart.create({
          name: kursart.name,
          maxParticipants: kursart.maxParticipants,
          requiresRoom: kursart.requiresRoom,
          sortOrder: i + 1,
        });
      }
      for (const minuten of START_DAUERN) {
        await tx.orm.public.Lektionsdauer.create({ minuten });
      }
      for (const tarifstufe of START_TARIFSTUFEN) {
        await tx.orm.public.Tarifstufe.create({ ...tarifstufe });
      }

      await tx.orm.public.SystemSetting.create({
        key: SEED_MARKER,
        value: new Date().toISOString(),
      });
    });

    console.log("Startdaten angelegt: Standorte/Räume, Sprachen, Niveaus, Kursarten, Dauern, Tarifstufen.");
  } catch (error) {
    // Seed darf den Start nie blockieren.
    console.error("Startdaten-Seeding fehlgeschlagen:", error);
  }
}
