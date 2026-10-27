import "server-only";

import { db } from "@/lib/db";

/**
 * Startdaten für den Fragenkatalog des Online-Einstufungstests (Modul 13):
 * Deutsch A1–B1 und Englisch A1–A2 als realistischer Startpunkt. Der Katalog
 * bleibt in den Stammdaten Admin-pflegbar (/stammdaten/einstufungstest);
 * gesät wird nur, wenn der eigene Marker fehlt — unabhängig vom Modul-2-
 * Startdaten-Marker, damit bestehende Datenbanken die Fragen nachrüsten.
 */

interface StartFrage {
  sprache: string;
  niveau: string;
  text: string;
  antworten: [string, string, string, string];
  /** 1-basierter Index der richtigen Antwort. */
  richtig: number;
}

const START_FRAGEN: StartFrage[] = [
  // Deutsch — A1 (richtige Antwort bewusst auf wechselnden Positionen)
  { sprache: "Deutsch", niveau: "A1", text: "Ich ___ aus der Schweiz.", antworten: ["hast", "bin", "ist", "sind"], richtig: 2 },
  { sprache: "Deutsch", niveau: "A1", text: "Wie ___ es Ihnen?", antworten: ["geht", "heiße", "wohne", "komme"], richtig: 1 },
  { sprache: "Deutsch", niveau: "A1", text: "Das ___ mein Bruder.", antworten: ["sind", "bist", "ist", "wären"], richtig: 3 },
  // Deutsch — A2
  { sprache: "Deutsch", niveau: "A2", text: "Ich ___ gestern ins Kino gegangen.", antworten: ["habe", "war", "ging", "bin"], richtig: 4 },
  { sprache: "Deutsch", niveau: "A2", text: "Er ___ jeden Tag mit dem Velo zur Arbeit.", antworten: ["fährt", "fahrt", "fahren", "fuhr"], richtig: 1 },
  { sprache: "Deutsch", niveau: "A2", text: "Ich habe letzte Woche ___ Bücher gelesen.", antworten: ["mehr", "viele", "viel", "meisten"], richtig: 2 },
  // Deutsch — B1
  { sprache: "Deutsch", niveau: "B1", text: "Obwohl es regnete, ___ wir wandern.", antworten: ["gingen", "gehen", "gehen würden", "gegangen"], richtig: 1 },
  { sprache: "Deutsch", niveau: "B1", text: "Ich hätte gern ___ Kaffee, bitte.", antworten: ["eine", "ein", "einen", "einem"], richtig: 3 },
  { sprache: "Deutsch", niveau: "B1", text: "Er hat das Auto ___.", antworten: ["repariert", "reparieren", "reparieren zu", "zum Reparieren"], richtig: 2 },
  // Englisch — A1
  { sprache: "Englisch", niveau: "A1", text: "She ___ a teacher.", antworten: ["am", "is", "are", "be"], richtig: 2 },
  { sprache: "Englisch", niveau: "A1", text: "I ___ from Italy.", antworten: ["be", "are", "is", "am"], richtig: 4 },
  // Englisch — A2
  { sprache: "Englisch", niveau: "A2", text: "We ___ to Spain last year.", antworten: ["went", "go", "have gone", "going"], richtig: 1 },
  { sprache: "Englisch", niveau: "A2", text: "There ___ some milk in the fridge.", antworten: ["are", "were", "is", "be"], richtig: 3 },
];

const SEED_MARKER = "anfragen.fragenStartdaten";

export async function seedEinstufungsfragen(): Promise<void> {
  try {
    const marker = await db.orm.public.SystemSetting.where({ key: SEED_MARKER }).first();
    if (marker) return;

    const fragenCount = await db.orm.public.Einstufungsfrage.aggregate((a) => ({ n: a.count() })).then((r) => r.n);
    if (fragenCount > 0) {
      // Manuell vorbefüllt — nur merken, damit nie erneut geprüft wird.
      await db.orm.public.SystemSetting.create({ key: SEED_MARKER, value: new Date().toISOString() });
      return;
    }

    const [sprachen, niveaus] = await Promise.all([
      db.orm.public.Sprache.all(),
      db.orm.public.Niveau.all(),
    ]);
    const spracheByName = new Map(sprachen.map((s) => [s.name, s.id]));
    const niveauByCode = new Map(niveaus.map((n) => [n.code, n.id]));

    // Reihenfolge innerhalb Sprache × Niveau fortlaufend nummerieren.
    const laufzaehler = new Map<string, number>();
    for (const frage of START_FRAGEN) {
      const spracheId = spracheByName.get(frage.sprache);
      const niveauId = niveauByCode.get(frage.niveau);
      if (!spracheId || !niveauId) continue; // Sprache/Niveau fehlen — überspringen
      const gruppe = `${spracheId}:${niveauId}`;
      const sortOrder = (laufzaehler.get(gruppe) ?? 0) + 1;
      laufzaehler.set(gruppe, sortOrder);
      await db.orm.public.Einstufungsfrage.create({
        spracheId,
        niveauId,
        text: frage.text,
        antwort1: frage.antworten[0],
        antwort2: frage.antworten[1],
        antwort3: frage.antworten[2],
        antwort4: frage.antworten[3],
        richtig: frage.richtig,
        sortOrder,
      });
    }

    await db.orm.public.SystemSetting.create({ key: SEED_MARKER, value: new Date().toISOString() });
    console.log("Startdaten angelegt: Fragenkatalog Einstufungstest (Deutsch A1–B1, Englisch A1–A2).");
  } catch (error) {
    // Seed darf den Start nie blockieren.
    console.error("Fragenkatalog-Seeding fehlgeschlagen:", error);
  }
}
