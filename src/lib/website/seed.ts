import "server-only";

import { db } from "@/lib/db";
import { sprachenSlug } from "./logik";

/**
 * Startdaten für die öffentliche Website (Modul 15): Startseite, Über uns,
 * Kontakt, AGB/Datenschutz (Fuss) und eine SEO-Unterseite pro Stammdaten-
 * Sprache plus «Weitere Sprachen». Läuft beim Serverstart; der eigene Seed-
 * Marker verhindert Wiederholung (unabhängig von den Modul-2-Markern, damit
 * bestehende Datenbanken die Seiten nachrüsten). Das Pop-up wird bewusst
 * inaktiv angelegt — es wird erst vom Büro aktiviert.
 */

const SEED_MARKER = "website.startdaten";

interface StartSeite {
  slug: string;
  typ: "START" | "SPRACHE" | "SEITE";
  inNavigation: boolean;
  navSortOrder: number;
  imFuss: boolean;
  de: { titel: string; untertitel: string | null; inhalt: string; seoTitel: string | null; seoBeschreibung: string | null };
  en: { titel: string; untertitel: string | null; inhalt: string; seoTitel: string | null; seoBeschreibung: string | null } | null;
}

const SPRACHEN_TEXT: Record<string, { de: string; en: string }> = {
  Deutsch: {
    de: "Deutsch lernen in Schaffhausen und Winterthur — von A1 bis C2, in kleinen Gruppen von maximal 6 Teilnehmenden oder im Einzelunterricht.",
    en: "Learn German in Schaffhausen and Winterthur — from A1 to C2, in small groups of at most 6 participants or in one-to-one lessons.",
  },
  Englisch: {
    de: "Englisch für Beruf, Reisen und Alltag — kleine Gruppen, individuelle Betreuung, alle Niveaus von A1 bis C2.",
    en: "English for work, travel and everyday life — small groups, personal attention, all levels from A1 to C2.",
  },
  Italienisch: {
    de: "Italienisch für Freizeit, Familie und Ferien — lebendiger Unterricht in kleinen Gruppen.",
    en: "Italian for leisure, family and holidays — lively lessons in small groups.",
  },
  Französisch: {
    de: "Französisch für Beruf und Alltag — praxisnah und an Ihr Niveau angepasst.",
    en: "French for work and everyday life — practical and tailored to your level.",
  },
  Spanisch: {
    de: "Spanisch für Reisen und Kommunikation — entspannt lernen in kleinen Gruppen.",
    en: "Spanish for travel and communication — learn in a relaxed atmosphere in small groups.",
  },
};

function sprachenseite(name: string, sortOrder: number): StartSeite {
  const text = SPRACHEN_TEXT[name] ?? {
    de: `${name} lernen in kleinen Gruppen oder im Einzelunterricht.`,
    en: `Learn ${name} in small groups or in one-to-one lessons.`,
  };
  return {
    slug: sprachenSlug(name),
    typ: "SPRACHE",
    inNavigation: true,
    navSortOrder: sortOrder,
    imFuss: false,
    de: {
      titel: name,
      untertitel: `${name}-Kurse an der Sprachschule linguasud`,
      inhalt: `${text.de}\n\n## So geht es weiter\n\nSehen Sie unten, welche ${name}-Kurse aktuell freie Plätze haben. Passt kein Termin? Stellen Sie einfach eine Anfrage — wir eröffnen bei genügend Interesse neue Kurse.`,
      seoTitel: `${name} lernen in Schaffhausen & Winterthur · linguasud`,
      seoBeschreibung: `${text.de} Kurse mit freien Plätzen finden Sie auf dieser Seite.`,
    },
    en: {
      titel: name,
      untertitel: `${name} courses at linguasud language school`,
      inhalt: `${text.en}\n\n## How to continue\n\nBelow you can see which ${name} courses currently have places available. No suitable time? Simply send us a request — we open new courses with sufficient demand.`,
      seoTitel: `Learn ${name} in Schaffhausen & Winterthur · linguasud`,
      seoBeschreibung: `${text.en} Courses with places available are listed on this page.`,
    },
  };
}

const START_SEITEN: StartSeite[] = [
  {
    slug: "start",
    typ: "START",
    inNavigation: false,
    navSortOrder: 0,
    imFuss: false,
    de: {
      titel: "Sprachschule linguasud",
      untertitel: "Sprachen lernen in Schaffhausen und Winterthur — persönlich, in kleinen Gruppen, auf Ihrem Niveau.",
      inhalt:
        "Willkommen bei linguasud. Wir unterrichten Deutsch, Englisch, Italienisch, Französisch, Spanisch und weitere Sprachen — in kleinen Gruppen von maximal 6 Teilnehmenden, im Einzelunterricht oder als Firmenkurs vor Ort.\n\n## Warum linguasud?\n\n- Kleine Gruppen und individuelle Betreuung\n- Fortlaufende Kurse — einsteigen, wann immer ein Platz frei ist\n- Qualifizierte Lehrpersonen mit Swiss-Click-Erfahrung\n- Zentrale Lagen in Schaffhausen und Winterthur\n\n## Nicht sicher, welches Niveau?\n\nMachen Sie unseren kostenlosen Einstufungstest — in wenigen Minuten erhalten Sie eine Niveau-Empfehlung und können direkt eine Kursanfrage stellen.",
      seoTitel: "Sprachschule Schaffhausen & Winterthur · linguasud",
      seoBeschreibung:
        "Sprachschule linguasud: Deutsch, Englisch, Italienisch, Französisch, Spanisch und weitere Sprachen — kleine Gruppen, freie Plätze live, Einstufungstest online.",
    },
    en: {
      titel: "linguasud Language School",
      untertitel: "Learn languages in Schaffhausen and Winterthur — personal, in small groups, at your level.",
      inhalt:
        "Welcome to linguasud. We teach German, English, Italian, French, Spanish and other languages — in small groups of at most 6 participants, one-to-one or as in-company courses.\n\n## Why linguasud?\n\n- Small groups and personal attention\n- Ongoing courses — join whenever a place is free\n- Qualified teachers\n- Central locations in Schaffhausen and Winterthur\n\n## Not sure about your level?\n\nTake our free placement test — in a few minutes you will get a level recommendation and can send a course request straight away.",
      seoTitel: "Language school Schaffhausen & Winterthur · linguasud",
      seoBeschreibung:
        "linguasud language school: German, English, Italian, French, Spanish and more — small groups, live availability, online placement test.",
    },
  },
  {
    slug: "ueber-uns",
    typ: "SEITE",
    inNavigation: true,
    navSortOrder: 10,
    imFuss: false,
    de: {
      titel: "Über uns",
      untertitel: "Persönliche Sprachschule in Schaffhausen und Winterthur.",
      inhalt:
        "linguasud ist eine persönliche Sprachschule mit Standorten in Schaffhausen (Vorstadt 18, Stadthausgasse 16) und Winterthur (Bahnhofplatz 9). Wir begleiten Menschen, die in der Schweiz leben, arbeiten oder ankommen — vom ersten Wort bis zum diplomierten Niveau.\n\n## Unser Ansatz\n\n- Kleine Gruppen (maximal 6) oder Einzelunterricht\n- Fortlaufende Kurse ohne feste Semester — Sie starten, wenn ein Platz frei ist\n- Unterricht an 14/15-Lektionen-Paketen, transparent abgerechnet\n- Einstufungstest und persönliche Beratung vor dem Start\n\n## Unser Team\n\nUnser Kollegium umfasst qualifizierte Lehrpersonen für Deutsch, Englisch, Italienisch, Französisch, Spanisch und weitere Sprachen — jede:r mit Qualifikationen für die unterrichteten Niveaus.\n\n(Starttext — bitte in der Verwaltung unter «Website» anpassen.)",
      seoTitel: "Über uns · Sprachschule linguasud",
      seoBeschreibung: "Persönliche Sprachschule in Schaffhausen und Winterthur — kleine Gruppen, fortlaufende Kurse, qualifizierte Lehrpersonen.",
    },
    en: {
      titel: "About us",
      untertitel: "A personal language school in Schaffhausen and Winterthur.",
      inhalt:
        "linguasud is a personal language school with locations in Schaffhausen (Vorstadt 18, Stadthausgasse 16) and Winterthur (Bahnhofplatz 9). We support people who live, work or arrive in Switzerland — from the first word to a certified level.\n\n## Our approach\n\n- Small groups (max. 6) or one-to-one lessons\n- Ongoing courses without fixed semesters — you start when a place is free\n- Lessons booked in packages of 14/15 lessons, invoiced transparently\n- Placement test and personal advice before you start\n\n## Our team\n\nOur team consists of qualified teachers for German, English, Italian, French, Spanish and other languages — each qualified for the levels they teach.\n\n(Starting text — please adapt in the admin area under «Website».)",
      seoTitel: "About us · linguasud language school",
      seoBeschreibung: "Personal language school in Schaffhausen and Winterthur — small groups, ongoing courses, qualified teachers.",
    },
  },
  {
    slug: "kontakt",
    typ: "SEITE",
    inNavigation: true,
    navSortOrder: 40,
    imFuss: false,
    de: {
      titel: "Kontakt",
      untertitel: "Wir freuen uns auf Ihre Anfrage.",
      inhalt:
        "Rufen Sie uns an, schreiben Sie uns — oder nutzen Sie direkt unsere Online-Formulare. Den schnellsten Weg zu einem passenden Kurs finden Sie über den Einstufungstest.\n\n## Unsere Standorte\n\n- Vorstadt 18, 8200 Schaffhausen\n- Stadthausgasse 16, 8200 Schaffhausen\n- Bahnhofplatz 9, 8400 Winterthur\n\n## Online anfragen\n\n- Einstufungstest: finden Sie in wenigen Minuten Ihr Niveau\n- Anfrage stellen: direkt mit Kursvorschlag melden",
      seoTitel: "Kontakt · Sprachschule linguasud",
      seoBeschreibung: "Kontaktieren Sie die Sprachschule linguasud in Schaffhausen und Winterthur — Anfrage stellen oder Einstufungstest machen.",
    },
    en: {
      titel: "Contact",
      untertitel: "We look forward to hearing from you.",
      inhalt:
        "Call us, write to us — or use our online forms directly. The fastest way to a suitable course is the placement test.\n\n## Our locations\n\n- Vorstadt 18, 8200 Schaffhausen\n- Stadthausgasse 16, 8200 Schaffhausen\n- Bahnhofplatz 9, 8400 Winterthur\n\n## Request online\n\n- Placement test: find your level in a few minutes\n- Course request: get a course proposal directly",
      seoTitel: "Contact · linguasud language school",
      seoBeschreibung: "Contact linguasud language school in Schaffhausen and Winterthur — send a request or take the placement test.",
    },
  },
  {
    slug: "agb",
    typ: "SEITE",
    inNavigation: false,
    navSortOrder: 90,
    imFuss: true,
    de: {
      titel: "AGB",
      untertitel: null,
      inhalt:
        "## 1. Geltungsbereich\n\nDiese Allgemeinen Geschäftsbedingungen gelten für alle Kursanmeldungen und Verträge zwischen der Sprachschule linguasud und den Kursteilnehmenden.\n\n## 2. Anmeldung und Zahlung\n\nAnmeldungen werden nach Verfügbarkeit bestätigt. Kurspakete (14/15 Lektionen) werden in Rechnung gestellt; die Zahlungsfrist steht auf der Rechnung.\n\n## 3. Absenzen\n\nUnentschuldigte Absenzen werden vom Guthaben abgezogen; entschuldigte Absenzen (bis zum Ende des Kurstages gemeldet) nicht.\n\n## 4. Kursabsagen durch die Schule\n\nSagt die Schule eine Lektion ab (z.B. Krankheit der Lehrperson), wird das Guthaben nicht belastet.\n\n(Starttext — vom Büro in der Verwaltung anzupassen.)",
      seoTitel: "AGB · Sprachschule linguasud",
      seoBeschreibung: "Allgemeine Geschäftsbedingungen der Sprachschule linguasud.",
    },
    en: null,
  },
  {
    slug: "datenschutz",
    typ: "SEITE",
    inNavigation: false,
    navSortOrder: 91,
    imFuss: true,
    de: {
      titel: "Datenschutz",
      untertitel: null,
      inhalt:
        "## Verantwortliche Stelle\n\nSprachschule linguasud, Schaffhausen. Fragen zum Datenschutz richten Sie an buero@linguasud.com.\n\n## Welche Daten wir verarbeiten\n\nBei einer Kursanfrage oder einem Einstufungstest verarbeiten wir Name, E-Mail, Telefonnummer und Ihre Angaben zum gewünschten Kurs. Diese Daten dienen ausschliesslich der Bearbeitung Ihrer Anfrage und der Kursorganisation.\n\n## Wie lange wir speichern\n\nAnfragedaten werden gelöscht, sobald sie für die Bearbeitung nicht mehr benötigt werden; Kursdaten entsprechend den gesetzlichen Aufbewahrungspflichten.\n\n## Ihre Rechte\n\nSie können jederzeit Auskunft, Berichtigung oder Löschung Ihrer Daten verlangen.\n\n(Starttext — vom Büro in der Verwaltung anzupassen.)",
      seoTitel: "Datenschutz · Sprachschule linguasud",
      seoBeschreibung: "Datenschutzerklärung der Sprachschule linguasud.",
    },
    en: null,
  },
  {
    slug: "sprachen/weitere",
    typ: "SEITE",
    inNavigation: true,
    navSortOrder: 30,
    imFuss: false,
    de: {
      titel: "Weitere Sprachen",
      untertitel: "Portugiesisch, Russisch, Türkisch und mehr — auf Anfrage.",
      inhalt:
        "Neben den oben gelisteten Sprachen unterrichten wir auf Anfrage weitere Sprachen — zum Beispiel Portugiesisch, Russisch, Türkisch oder Niederländisch. Einzelunterricht und Firmenkurse sind jederzeit möglich, Gruppenkurse eröffnen wir bei genügend Interesse.\n\n## Interesse?\n\nStellen Sie eine Anfrage mit Ihrer Wunschsprache — wir melden uns mit einem Vorschlag.",
      seoTitel: "Weitere Sprachen lernen · linguasud",
      seoBeschreibung: "Weitere Sprachen auf Anfrage: Portugiesisch, Russisch, Türkisch und mehr — Einzelunterricht und Firmenkurse jederzeit möglich.",
    },
    en: {
      titel: "Other languages",
      untertitel: "Portuguese, Russian, Turkish and more — on request.",
      inhalt:
        "In addition to the languages listed above, we teach other languages on request — for example Portuguese, Russian, Turkish or Dutch. One-to-one lessons and in-company courses are possible at any time; group courses open with sufficient demand.\n\n## Interested?\n\nSend us a request with your preferred language — we will get back to you with a proposal.",
      seoTitel: "Learn other languages · linguasud",
      seoBeschreibung: "Other languages on request: Portuguese, Russian, Turkish and more — one-to-one and in-company courses at any time.",
    },
  },
];

async function erstelleSeite(seite: StartSeite, spracheId: string | null): Promise<void> {
  const row = await db.orm.public.WebsiteSeite.create({
    slug: seite.slug,
    typ: seite.typ,
    spracheId,
    inNavigation: seite.inNavigation,
    navSortOrder: seite.navSortOrder,
    imFuss: seite.imFuss,
    active: true,
  });
  await db.orm.public.WebsiteSeiteUebersetzung.create({
    seiteId: row.id,
    locale: "DE",
    titel: seite.de.titel,
    untertitel: seite.de.untertitel,
    inhalt: seite.de.inhalt,
    seoTitel: seite.de.seoTitel,
    seoBeschreibung: seite.de.seoBeschreibung,
  });
  if (seite.en) {
    await db.orm.public.WebsiteSeiteUebersetzung.create({
      seiteId: row.id,
      locale: "EN",
      titel: seite.en.titel,
      untertitel: seite.en.untertitel,
      inhalt: seite.en.inhalt,
      seoTitel: seite.en.seoTitel,
      seoBeschreibung: seite.en.seoBeschreibung,
    });
  }
}

export async function seedWebsiteStartdaten(): Promise<void> {
  try {
    const marker = await db.orm.public.SystemSetting.where({ key: SEED_MARKER }).first();
    if (marker) return;

    const bestehend = await db.orm.public.WebsiteSeite.aggregate((a) => ({ n: a.count() })).then((r) => r.n);
    if (bestehend > 0) {
      // Manuell vorbefüllt — nur merken, damit nie erneut geprüft wird.
      await db.orm.public.SystemSetting.create({ key: SEED_MARKER, value: new Date().toISOString() });
      return;
    }

    // Inaktives Pop-up als Vorlage (Büro aktiviert es, sobald gewünscht).
    await db.orm.public.WebsitePopup.create({
      titel: "Willkommen bei linguasud",
      text: "Willkommen auf unserer neuen Website! Machen Sie den kostenlosen Einstufungstest und finden Sie in wenigen Minuten Ihr Kursniveau.",
      aktiv: false,
    });

    for (const seite of START_SEITEN) {
      await erstelleSeite(seite, null);
    }

    // Sprachseiten für alle aktiven Stammdaten-Sprachen (Deutsch, Englisch, …).
    const sprachen = await db.orm.public.Sprache.where((s) => s.active.eq(true)).orderBy((s) => s.name.asc()).all();
    let sortOrder = 20;
    for (const sprache of sprachen) {
      await erstelleSeite(sprachenseite(sprache.name, sortOrder), sprache.id);
      sortOrder += 1;
    }

    await db.orm.public.SystemSetting.create({ key: SEED_MARKER, value: new Date().toISOString() });
    console.log("Startdaten angelegt: Öffentliche Website (Seiten, Übersetzungen, Sprachseiten, Pop-up-Vorlage).");
  } catch (error) {
    // Seed darf den Start nie blockieren.
    console.error("Website-Seed fehlgeschlagen:", error);
  }
}
