import "server-only";

import { prisma } from "@/lib/db";

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
    const marker = await prisma.systemSetting.findUnique({ where: { key: SEED_MARKER } });
    if (marker) return;

    const standortCount = await prisma.standort.count();
    if (standortCount > 0) {
      // Manuell vorbefüllt — nichts säen, aber merken, damit wir nie erneut prüfen.
      await prisma.systemSetting.create({
        data: { key: SEED_MARKER, value: new Date().toISOString() },
      });
      return;
    }

    for (const standort of START_STANDORTE) {
      await prisma.standort.create({
        data: {
          name: standort.name,
          strasse: standort.strasse,
          plz: standort.plz,
          ort: standort.ort,
          etagen: {
            create: standort.etagen.map((etage, etageIndex) => ({
              name: etage.name,
              sortOrder: etageIndex,
              raeume: {
                create: Array.from({ length: etage.raeume }, (_, i) => ({
                  // Platzhalter bis die echten Raumnamen erfasst sind.
                  name: `Raum ${etageIndex + 1}.${String(i + 1).padStart(2, "0")}`,
                  seats: 0,
                })),
              },
            })),
          },
        },
      });
    }

    await prisma.sprache.createMany({
      data: START_SPRACHEN.map((s) => ({ name: s.name, code: s.code })),
    });
    await prisma.niveau.createMany({
      data: START_NIVEAUS.map((code, i) => ({ code, sortOrder: i + 1 })),
    });
    await prisma.kursart.createMany({
      data: START_KURSARTEN.map((k, i) => ({
        name: k.name,
        maxParticipants: k.maxParticipants,
        requiresRoom: k.requiresRoom,
        sortOrder: i + 1,
      })),
    });
    await prisma.lektionsdauer.createMany({ data: START_DAUERN.map((minuten) => ({ minuten })) });
    await prisma.tarifstufe.createMany({ data: START_TARIFSTUFEN.map((t) => ({ ...t })) });

    await prisma.systemSetting.create({
      data: { key: SEED_MARKER, value: new Date().toISOString() },
    });

    console.log("Startdaten angelegt: Standorte/Räume, Sprachen, Niveaus, Kursarten, Dauern, Tarifstufen.");
  } catch (error) {
    // Seed darf den Start nie blockieren.
    console.error("Startdaten-Seeding fehlgeschlagen:", error);
  }
}
