import { connection } from "next/server";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

// Zentrale Renderlogik der öffentlichen Website (Modul 15): auflösen des
// Pfads (CMS-Seite, Sprachseite mit Live-Kursen, Start), Rahmen mit Pop-up
// und Inhalt. Von «/» (page.tsx) und dem Catch-all «/[[...slug]]» genutzt.

import { getEnv } from "@/lib/env";
import {
  ladeAktivesPopup,
  ladeFusslinks,
  ladeKurseFuerSprache,
  ladeNavigation,
  ladeOeffentlicheSeite,
  ladeSpracheFuerSlugPfad,
  ladeSprachseiten,
} from "@/lib/website/daten";
import { UI_TEXT, type Locale } from "@/lib/website/logik";
import {
  HandlungsKarten,
  KursListe,
  WebsiteInhalt,
} from "./WebsiteInhalt";
import { WebsiteRahmen } from "./WebsiteRahmen";

export interface PfadAufloesung {
  locale: Locale;
  /** Pfad ohne Locale-Präfix («», «ueber-uns», «sprachen/deutsch»). */
  pfad: string;
  /** hreflang-Kanoniker: Pfad für die jeweils andere Sprache. */
  hreflangPfad: string;
}

/** Zerlegt Catch-all-Segmente in Locale + Pfad («en/sprachen/deutsch» → en + «sprachen/deutsch»). */
export function zerlegePfad(segmente: string[]): PfadAufloesung {
  const locale: Locale = segmente[0] === "en" ? "en" : "de";
  const rest = locale === "en" ? segmente.slice(1) : segmente;
  const pfad = rest.join("/");
  return { locale, pfad, hreflangPfad: pfad };
}

/**
 * Rendert die öffentliche Seite: CMS-Inhalt, bei Sprachseiten die Live-
 * Kursliste (freie Plätze), auf Start/Kontakt die Karten zu den bestehenden
 * Formularen (Modul 13). Unbekannte Pfade → 404.
 */
export async function OeffentlicheSeite({ segmente }: { segmente: string[] }) {
  await connection();
  const { locale, pfad } = zerlegePfad(segmente);
  const t = UI_TEXT[locale];

  const [cookieStore, nav, fuss, sprachseiten] = await Promise.all([
    cookies(),
    ladeNavigation(locale),
    ladeFusslinks(locale),
    ladeSprachseiten(locale),
  ]);

  // Pop-up: aktiv + Zeitfenster + vom Besucher nicht heute geschlossen.
  const jetzt = new Date();
  const popup = await ladeAktivesPopup(jetzt);
  const popupGeschlossen = popup
    ? Boolean(await cookieStore.get(`popup_geschlossen_${popup.id}`))
    : false;

  let kopf: { titel: string; untertitel: string | null } | null = null;
  let inhalt: React.ReactNode = null;

  if (pfad === "") {
    const seite = await ladeOeffentlicheSeite("start", locale);
    if (!seite) notFound();
    kopf = { titel: seite.inhalt.titel, untertitel: seite.inhalt.untertitel };
    inhalt = (
      <>
        <WebsiteInhalt inhalt={seite.inhalt.inhalt} />
        <HandlungsKarten locale={locale} />
        {sprachseiten.length > 0 && (
          <section className="mt-6">
            <h2 className="text-base font-semibold text-slate-900">{t.navSprachen}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {sprachseiten.map((s) => (
                <Link
                  key={s.href}
                  href={locale === "de" ? s.href : `/en${s.href}`}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-300 hover:text-brand-800"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </>
    );
  } else {
    // Erst CMS-Seite («ueber-uns», «kontakt», «sprachen/weitere», …), dann
    // Sprach-Fallback aus den Stammdaten (neue Sprache ohne CMS-Seite).
    const seite = await ladeOeffentlicheSeite(pfad, locale);
    const istSprachpfad = pfad.startsWith("sprachen/");
    const sprache = istSprachpfad ? await ladeSpracheFuerSlugPfad(pfad) : null;
    if (!seite && !sprache) notFound();

    if (seite) {
      kopf = { titel: seite.inhalt.titel, untertitel: seite.inhalt.untertitel };
      inhalt = <WebsiteInhalt inhalt={seite.inhalt.inhalt} />;
    } else if (sprache) {
      kopf = {
        titel: sprache.name,
        untertitel:
          locale === "en"
            ? `${sprache.name} courses at linguasud`
            : `${sprache.name}-Kurse an der Sprachschule linguasud`,
      };
      inhalt = null;
    }

    // Sprachseite (CMS oder Fallback): Live-Kursliste mit freien Plätzen.
    if (sprache) {
      const kurse = await ladeKurseFuerSprache(sprache.id, locale);
      inhalt = (
        <>
          {inhalt}
          <KursListe kurse={kurse} locale={locale} spracheId={sprache.id} />
        </>
      );
    }

    // Kontakt: Karten zu den bestehenden Modul-13-Formularen (keine Doppellogik).
    if (pfad === "kontakt") {
      inhalt = (
        <>
          {inhalt}
          <HandlungsKarten locale={locale} />
        </>
      );
    }
  }

  return (
    <WebsiteRahmen
      locale={locale}
      pfad={pfad}
      nav={nav}
      fuss={fuss}
      popup={popup}
      popupGeschlossen={popupGeschlossen}
    >
      <article className="card p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">{kopf?.titel}</h1>
        {kopf?.untertitel && <p className="mt-1 text-sm text-slate-600">{kopf.untertitel}</p>}
        <div className="mt-5">{inhalt}</div>
      </article>
    </WebsiteRahmen>
  );
}

/** Metadata-Titel/Beschreibung + hreflang-Alternates für eine öffentliche Seite. */
export async function ladeMetadataFuerPfad(
  segmente: string[],
): Promise<{ titel: string; beschreibung: string | null; pfad: string } | null> {
  const { locale, pfad } = zerlegePfad(segmente);
  if (pfad === "") {
    const seite = await ladeOeffentlicheSeite("start", locale);
    if (!seite) return null;
    return { titel: seite.inhalt.seoTitel ?? seite.inhalt.titel, beschreibung: seite.inhalt.seoBeschreibung ?? seite.inhalt.untertitel, pfad };
  }
  const seite = await ladeOeffentlicheSeite(pfad, locale);
  if (seite) {
    return { titel: seite.inhalt.seoTitel ?? seite.inhalt.titel, beschreibung: seite.inhalt.seoBeschreibung ?? seite.inhalt.untertitel, pfad };
  }
  const sprache = await ladeSpracheFuerSlugPfad(pfad);
  if (!sprache) return null;
  return {
    titel: locale === "en" ? `Learn ${sprache.name} · linguasud` : `${sprache.name} lernen · Sprachschule linguasud`,
    beschreibung: locale === "en" ? `${sprache.name} courses with places available at linguasud.` : `${sprache.name}-Kurse mit freien Plätzen an der Sprachschule linguasud.`,
    pfad,
  };
}

/** hreflang-Alternates (APP_URL aus der Env; Domain-Entscheid bleibt offen). */
export function alternatesFuer(pfad: string) {
  const basis = getEnv().APP_URL.replace(/\/$/, "");
  const pf = pfad ? `/${pfad}` : "";
  return {
    canonical: `${basis}${pf || "/"}`,
    languages: {
      de: `${basis}${pf || "/"}`,
      en: `${basis}/en${pf}`,
      // Deutsch ist die Standard-Sprache (x-default ohne Locale-Präfix).
      "x-default": `${basis}${pf || "/"}`,
    },
  };
}
