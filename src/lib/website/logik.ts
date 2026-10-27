// Website-Domänenlogik (Modul 15) — rein, ohne Server-Abhängigkeiten, getestet:
// - Sprach-Slugs aus den Stammdaten-Namen (SEO-URLs wie /sprachen/deutsch)
// - Zeitfenster-Prüfung des Pop-ups (serverseitig gesteuert, kein Flackern)
// - Freie Plätze in Gruppenkursen (volle Kurse werden nicht angezeigt)
// - Kompakter UI-Wortschatz DE/EN (feste Texte der öffentlichen Website)
// - Inhalts-Parser für die CMS-Texte (Klartext, kein HTML)

/** UI-Sprache der öffentlichen Website. */
export type Locale = "de" | "en";

export const LOCALES: Locale[] = ["de", "en"];

/** RESERVED: URL-Pfade, die nicht als CMS-Slug vergeben werden dürfen. */
export const RESERVIERTER_ROOT = new Set([
  "en",
  "start",
  "sprachen",
  "anfrage",
  "einstufungstest",
  "bestaetigungen",
  "portal",
  "login",
  "passwort-aendern",
  "api",
]);

/** Slug aus einem Namen (z.B. Sprache «Französisch» → «franzoesisch»). */
export function slugifyName(name: string): string {
  const basis = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return basis;
}

/** Gültiger CMS-Slug? («ueber-uns», «sprachen/deutsch» — keine doppelten Striche.) */
export function istGueltigerSlug(slug: string): boolean {
  if (!slug) return false;
  return slug.split("/").every((part) => /^[a-z0-9][a-z0-9-]*$/.test(part) && !part.includes("--"));
}

/** Prüft Slug gegen reservierte Wörter. Bare-Roots sind gesperrt; nur
 *  «sprachen/<name>» (Sprach-/weitere-Unterseiten) ist als Pfad erlaubt. */
export function istSlugVerboten(slug: string): boolean {
  const root = slug.split("/")[0];
  if (root === "sprachen") return slug === "sprachen";
  return RESERVIERTER_ROOT.has(root);
}

// ——— Pop-up: serverseitige Zeitfenster-Steuerung ———————————————————————

export interface PopupKandidat {
  id: string;
  aktiv: boolean;
  /** ms-Epoch oder null (unbeschränkt nach dem anderen Ende). */
  gueltigVon: number | null;
  gueltigBis: number | null;
}

/** Liefert das anzuzeigende Pop-up: aktiv, Zeitfenster umfasst «jetzt»; bei
 *  mehreren Kandidaten gewinnt der späteste Gültig-ab-Zeitpunkt. */
export function waehlePopup(
  popups: PopupKandidat[],
  jetzt: number,
): PopupKandidat | null {
  const aktiv = popups
    .filter(
      (p) =>
        p.aktiv &&
        (p.gueltigVon === null || p.gueltigVon <= jetzt) &&
        (p.gueltigBis === null || jetzt <= p.gueltigBis),
    )
    .sort((a, b) => (b.gueltigVon ?? Number.NEGATIVE_INFINITY) - (a.gueltigVon ?? Number.NEGATIVE_INFINITY));
  return aktiv[0] ?? null;
}

// ——— Freie Plätze in Gruppenkursen ——————————————————————————————————————

export interface KursPlatzLage {
  /** Effektive Obergrenze (Kurs übersteuert Kursart); null = individuell. */
  maxTeilnehmende: number | null;
  /** Belegte Plätze (Anmeldungen PROBE + AKTIV). */
  belegt: number;
}

/** Gruppenkurs = ≥ 2 Plätze (Einzel- und Firmenkurse erscheinen nicht). */
export function istGruppenkurs(lage: KursPlatzLage): boolean {
  return lage.maxTeilnehmende !== null && lage.maxTeilnehmende >= 2;
}

/** Freie Plätze (0, wenn voll oder übervoll); volle Kurse werden ausgeblendet. */
export function freiePlaetze(lage: KursPlatzLage): number {
  if (lage.maxTeilnehmende === null) return 0;
  return Math.max(0, lage.maxTeilnehmende - lage.belegt);
}

/** Wird der Kurs auf der Website angezeigt? (Gruppenkurs mit mindestens einem Platz) */
export function wirdAngezeigt(lage: KursPlatzLage): boolean {
  return istGruppenkurs(lage) && freiePlaetze(lage) > 0;
}

/** «3 freie Plätze» / «Letzter freier Platz» (DE/EN). */
export function plaetzeLabel(frei: number, locale: Locale): string {
  if (locale === "en") {
    return frei === 1 ? "1 place available" : `${frei} places available`;
  }
  return frei === 1 ? "1 freier Platz" : `${frei} freie Plätze`;
}

// ——— Wochentag/Zeit für die Kursliste ———————————————————————————————————

export const WOCHENTAG_LABELS: Record<Locale, string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

/** Wochentag (1=Mo … 7=So) + Startzeit «HH:mm» + Dauer → «Di 17:30 · 60 Min.». */
export function formatiereKursTermin(
  wochentag: number | null,
  startZeit: string | null,
  dauerMinuten: number | null,
  locale: Locale,
): string | null {
  if (!wochentag || !startZeit) return null;
  const tag = WOCHENTAG_LABELS[locale][Math.min(6, Math.max(0, wochentag - 1))];
  const dauer = dauerMinuten ? (locale === "en" ? ` · ${dauerMinuten} min` : ` · ${dauerMinuten} Min.`) : "";
  return `${tag} ${startZeit}${dauer}`;
}

// ——— Feste UI-Texte DE/EN ———————————————————————————————————————————————

/** Feste Texte der öffentlichen Website (CMS-Seitentitel kommen aus der DB). */
export const UI_TEXT: Record<Locale, {
  start: string;
  navSprachen: string;
  einstufungstest: string;
  einstufungstestBeschreibung: string;
  anfrage: string;
  anfrageBeschreibung: string;
  kontakt: string;
  login: string;
  seiteNichtGefunden: string;
  seiteNichtGefundenText: string;
  startseiteLink: string;
  kurseMitPlaetzen: string;
  keineKurse: string;
  kursAnfrage: string;
  nivellabel: string;
  spracheHaupttitel: string;
  weitereSprachen: string;
}> = {
  de: {
    start: "Start",
    navSprachen: "Unsere Sprachen",
    einstufungstest: "Einstufungstest",
    einstufungstestBeschreibung:
      "Finden Sie in wenigen Minuten Ihr Einstiegsniveau — mit automatischer Empfehlung.",
    anfrage: "Anfrage stellen",
    anfrageBeschreibung:
      "Erzählen Sie uns, was Sie lernen möchten — wir melden uns mit einem Kursvorschlag.",
    kontakt: "Kontakt",
    login: "Verwaltung",
    seiteNichtGefunden: "Seite nicht gefunden",
    seiteNichtGefundenText: "Diese Seite existiert nicht (mehr).",
    startseiteLink: "Zur Startseite",
    kurseMitPlaetzen: "Kurse mit freien Plätzen",
    keineKurse: "Aktuell sind keine Gruppenkurse mit freien Plätzen buchbar — fragen Sie gern an, wir eröffnen bei genügend Interesse neue Kurse.",
    kursAnfrage: "Platz anfragen",
    nivellabel: "Niveau",
    spracheHaupttitel: "Sprachschule linguasud",
    weitereSprachen: "Weitere Sprachen",
  },
  en: {
    start: "Home",
    navSprachen: "Our languages",
    einstufungstest: "Placement test",
    einstufungstestBeschreibung:
      "Find your starting level in a few minutes — with an automatic recommendation.",
    anfrage: "Request a course",
    anfrageBeschreibung:
      "Tell us what you would like to learn — we will get back to you with a course proposal.",
    kontakt: "Contact",
    login: "Admin area",
    seiteNichtGefunden: "Page not found",
    seiteNichtGefundenText: "This page does not (or no longer) exist.",
    startseiteLink: "Back to the home page",
    kurseMitPlaetzen: "Courses with places available",
    keineKurse: "There are currently no group courses with places available — feel free to get in touch, we open new courses with sufficient demand.",
    kursAnfrage: "Request a place",
    nivellabel: "Level",
    spracheHaupttitel: "linguasud Language School",
    weitereSprachen: "Other languages",
  },
};

// ——— CMS-Inhalts-Parser (Klartext, kein HTML — Büro tippt ohne Code) —————

export type InhaltBlock =
  | { art: "titel"; text: string }
  | { art: "absatz"; text: string }
  | { art: "liste"; punkte: string[] };

/**
 * Parst CMS-Inhalte: Absätze durch Leerzeilen getrennt, Zeilen mit «## »
 * als Zwischentitel, direkt aufeinanderfolgende «- »-Zeilen als Aufzählung.
 */
export function parseInhalt(inhalt: string): InhaltBlock[] {
  const bloecke: InhaltBlock[] = [];
  const absaetze = inhalt.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  let punkte: string[] = [];
  const flushListe = () => {
    if (punkte.length > 0) {
      bloecke.push({ art: "liste", punkte });
      punkte = [];
    }
  };
  for (const absatz of absaetze) {
    const zeilen = absatz.split("\n").map((z) => z.trim()).filter(Boolean);
    for (const zeile of zeilen) {
      if (zeile.startsWith("## ")) {
        flushListe();
        bloecke.push({ art: "titel", text: zeile.slice(3).trim() });
      } else if (zeile.startsWith("- ")) {
        punkte.push(zeile.slice(2).trim());
      } else {
        flushListe();
        bloecke.push({ art: "absatz", text: zeile });
      }
    }
  }
  flushListe();
  return bloecke;
}

/** Sprache «Französisch» → /sprachen/franzoesisch (aus den Stammdaten abgeleitet). */
export function sprachenSlug(spracheName: string): string {
  return `sprachen/${slugifyName(spracheName)}`;
}
