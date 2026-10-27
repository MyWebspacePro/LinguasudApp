import "server-only";

// Datenzugriff der öffentlichen Website (Modul 15): CMS-Seiten samt
// Übersetzung, Hauptnavigation, Fusslinks, aktives Pop-up und die Live-Kurs-
// liste pro Sprache (freie Plätze aus der bestehenden Kurs-/Anmelde-Logik).

import { db, fromDbTime } from "@/lib/db";
import {
  freiePlaetze,
  sprachenSlug,
  wirdAngezeigt,
  type Locale,
  type PopupKandidat,
} from "./logik";

type UebersetzungRow = {
  locale: string;
  titel: string;
  untertitel: string | null;
  inhalt: string;
  seoTitel: string | null;
  seoBeschreibung: string | null;
};

export interface SeitenInhalt {
  locale: Locale;
  /** true, wenn die gewünschte Sprache fehlte und die DE-Fassung liefert. */
  fallback: boolean;
  titel: string;
  untertitel: string | null;
  inhalt: string;
  seoTitel: string | null;
  seoBeschreibung: string | null;
}

/** Wählt die Übersetzung zur gewünschten Sprache; fehlt sie, liefert DE. */
export function uebersetzungFuer(
  rows: UebersetzungRow[],
  locale: Locale,
): SeitenInhalt | null {
  const de = rows.find((r) => r.locale === "DE");
  const gewaehlt = locale === "en" ? (rows.find((r) => r.locale === "EN") ?? de) : de;
  if (!gewaehlt) return null;
  return {
    locale: gewaehlt.locale === "EN" ? "en" : "de",
    fallback: gewaehlt.locale !== (locale === "en" ? "EN" : "DE"),
    titel: gewaehlt.titel,
    untertitel: gewaehlt.untertitel,
    inhalt: gewaehlt.inhalt,
    seoTitel: gewaehlt.seoTitel,
    seoBeschreibung: gewaehlt.seoBeschreibung,
  };
}

/** Öffentliche CMS-Seite (inkl. Übersetzung mit DE-Fallback) oder null. */
export async function ladeOeffentlicheSeite(slug: string, locale: Locale): Promise<{
  typ: string;
  slug: string;
  inhalt: SeitenInhalt;
} | null> {
  const seite = await db.orm.public.WebsiteSeite
    .where((s) => s.slug.eq(slug))
    .where((s) => s.active.eq(true))
    .select("typ")
    .include("uebersetzungen")
    .first();
  if (!seite) return null;
  const inhalt = uebersetzungFuer(seite.uebersetzungen, locale);
  if (!inhalt) return null;
  return { typ: seite.typ, slug, inhalt };
}

export interface NavEintrag {
  href: string;
  label: string;
  /** Für die Sub-Liste «Unsere Sprachen» auf der Startseite/Navigation. */
  istSprache: boolean;
}

/** Hauptnavigation (Start, CMS-Seiten mit Sprachseiten eingestreut, Kontakt). */
export async function ladeNavigation(locale: Locale): Promise<NavEintrag[]> {
  const seiten = await db.orm.public.WebsiteSeite
    .where((s) => s.active.eq(true))
    .where((s) => s.inNavigation.eq(true))
    .orderBy((s) => s.navSortOrder.asc())
    .select("slug", "typ", "spracheId")
    .include("uebersetzungen")
    .all();
  const eintraege: NavEintrag[] = [];
  for (const seite of seiten) {
    const inhalt = uebersetzungFuer(seite.uebersetzungen, locale);
    if (!inhalt) continue;
    eintraege.push({
      href: seite.typ === "START" ? "/" : `/${seite.slug}`,
      label: inhalt.titel,
      istSprache: seite.typ === "SPRACHE",
    });
  }
  return eintraege;
}

export interface FussEintrag {
  href: string;
  label: string;
}

/** Links im Fuss (AGB, Datenschutz). */
export async function ladeFusslinks(locale: Locale): Promise<FussEintrag[]> {
  const seiten = await db.orm.public.WebsiteSeite
    .where((s) => s.active.eq(true))
    .where((s) => s.imFuss.eq(true))
    .orderBy((s) => s.navSortOrder.asc())
    .select("slug")
    .include("uebersetzungen")
    .all();
  const eintraege: FussEintrag[] = [];
  for (const seite of seiten) {
    const inhalt = uebersetzungFuer(seite.uebersetzungen, locale);
    if (inhalt) eintraege.push({ href: `/${seite.slug}`, label: inhalt.titel });
  }
  return eintraege;
}

/** Aktives Pop-up (Zeitfenster serverseitig geprüft) oder null. */
export async function ladeAktivesPopup(jetzt: Date): Promise<{
  id: string;
  titel: string;
  text: string;
  bildUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
} | null> {
  const { waehlePopup } = await import("./logik");
  const popups = await db.orm.public.WebsitePopup
    .where((p) => p.aktiv.eq(true))
    .select("id", "titel", "text", "bildUrl", "buttonLabel", "buttonUrl", "gueltigVon", "gueltigBis", "aktiv")
    .all();
  const kandidaten: PopupKandidat[] = popups.map((p) => ({
    id: p.id,
    aktiv: p.aktiv,
    gueltigVon: p.gueltigVon ? fromDbTime(String(p.gueltigVon)).getTime() : null,
    gueltigBis: p.gueltigBis ? fromDbTime(String(p.gueltigBis)).getTime() : null,
  }));
  const gewaehlt = waehlePopup(kandidaten, jetzt.getTime());
  if (!gewaehlt) return null;
  const row = popups.find((p) => p.id === gewaehlt.id);
  if (!row) return null;
  return {
    id: row.id,
    titel: row.titel,
    text: row.text,
    bildUrl: row.bildUrl,
    buttonLabel: row.buttonLabel,
    buttonUrl: row.buttonUrl,
  };
}

export interface OeffentlicherKurs {
  id: string;
  code: string;
  niveau: string;
  kursart: string;
  termin: string | null;
  /** Ort nur grob: Standortname oder «Online» — keine Raumdetais öffentlich. */
  ort: string | null;
  freiePlaetzeAnzahl: number;
}

/**
 * Gruppenkurse einer Sprache mit freien Plätzen (Modul 15):
 * belegt = Anmeldungen PROBE + AKTIV (bestehende Anmelde-Daten, keine eigene
 * Berechnung); Obergrenze = Kurs-Maximum, sonst Kursart-Standard. Volle Kurse
 * und Einzel-/Firmenkurse werden nicht angezeigt.
 */
export async function ladeKurseFuerSprache(spracheId: string, locale: Locale): Promise<OeffentlicherKurs[]> {
  const kurse = await db.orm.public.Kurs
    .where((k) => k.spracheId.eq(spracheId))
    .where((k) => k.status.in(["GEPLANT", "AKTIV"]))
    .include("kursart")
    .include("niveau")
    .include("standardRaum")
    .all();
  if (kurse.length === 0) return [];

  const anmeldungen = await db.orm.public.Anmeldung
    .where((a) => a.kursId.in(kurse.map((k) => k.id)))
    .where((a) => a.status.in(["PROBE", "AKTIV"]))
    .select("kursId", "status")
    .all();
  const belegtProKurs = new Map<string, number>();
  for (const a of anmeldungen) {
    belegtProKurs.set(a.kursId, (belegtProKurs.get(a.kursId) ?? 0) + 1);
  }

  const { formatiereKursTermin } = await import("./logik");
  const ergebnis: OeffentlicherKurs[] = [];
  for (const kurs of kurse) {
    const lage = {
      maxTeilnehmende: kurs.maxParticipants ?? kurs.kursart.maxParticipants,
      belegt: belegtProKurs.get(kurs.id) ?? 0,
    };
    if (!wirdAngezeigt(lage)) continue;
    const ort = kurs.extern
      ? null
      : kurs.standardRaum?.name
        ? (locale === "en" ? "On site" : "In der Schule")
        : (locale === "en" ? "Online" : "Online");
    ergebnis.push({
      id: kurs.id,
      code: kurs.code,
      niveau: kurs.niveau.code,
      kursart: kurs.kursart.name,
      termin: formatiereKursTermin(kurs.wochentag, kurs.startZeit, kurs.dauerMinuten, locale),
      ort,
      freiePlaetzeAnzahl: freiePlaetze(lage),
    });
  }
  return ergebnis.sort((a, b) => a.niveau.localeCompare(b.niveau) || a.code.localeCompare(b.code));
}

/** Sprachseiten + zugehörige Stammdaten-Sprache (für die Navigation/Sub-Liste). */
export async function ladeSprachseiten(locale: Locale): Promise<{ href: string; label: string; spracheId: string }[]> {
  const seiten = await db.orm.public.WebsiteSeite
    .where((s) => s.active.eq(true))
    .where((s) => s.typ.eq("SPRACHE"))
    .include("sprache")
    .select("slug")
    .include("uebersetzungen")
    .all();
  const eintraege: { href: string; label: string; spracheId: string }[] = [];
  for (const seite of seiten) {
    if (!seite.sprache) continue;
    const inhalt = uebersetzungFuer(seite.uebersetzungen, locale);
    if (!inhalt) continue;
    eintraege.push({ href: `/${seite.slug}`, label: inhalt.titel, spracheId: seite.sprache.id });
  }
  return eintraege.sort((a, b) => a.label.localeCompare(b.label));
}

/** Aktive Stammdaten-Sprachen, die noch keine CMS-Sprachseite haben (Seed-Hilfe). */
export async function sprachenOhneSeite(): Promise<{ id: string; name: string }[]> {
  const [sprachen, seiten] = await Promise.all([
    db.orm.public.Sprache.where((s) => s.active.eq(true)).orderBy((s) => s.name.asc()).all(),
    db.orm.public.WebsiteSeite.where((s) => s.typ.eq("SPRACHE")).select("spracheId").all(),
  ]);
  const belegt = new Set(seiten.map((s) => s.spracheId).filter(Boolean));
  return sprachen.filter((s) => !belegt.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
}

/** Aufzählung der verfügbaren Locales fürs hreflang/Alternates. */
export { sprachenSlug };

/** Stammdaten-Sprache zu einem «sprachen/<slug>»-Pfad (Fallback ohne CMS-Seite). */
export async function ladeSpracheFuerSlugPfad(pfad: string): Promise<{ id: string; name: string } | null> {
  const teile = pfad.split("/");
  if (teile.length !== 2 || teile[0] !== "sprachen" || !teile[1]) return null;
  const slug = teile[1];
  const sprachen = await db.orm.public.Sprache.where((s) => s.active.eq(true)).all();
  const { slugifyName } = await import("./logik");
  return sprachen.find((s) => slugifyName(s.name) === slug) ?? null;
}
