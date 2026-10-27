"use server";

// Website-CMS (Modul 15, Server-Actions): Seiten mit DE/EN-Übersetzungen und
// das Pop-up pflegen — Rechteprüfung auf Büro/Admin/Chef (Pflichtenheft:
// CMS durch Büro/Chef), jede Änderung im Audit-Log (website.*). Laut
// Anforderung wiederverwendete Muster: requireStaff-Guard, FormState mit
// Feldfehlern, isUniqueViolation, revalidatePath.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isUniqueViolation, toDbTime, type Role } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageWebsite } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { zonedTimeToUtc } from "@/lib/zeit";
import { istGueltigerSlug, istSlugVerboten } from "./logik";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireWebsiteManager(): Promise<{ actor: { id: string; email: string } } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte erneut anmelden." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageWebsite(ctx.user.roles as Role[])) {
    return { failure: { error: "Die Website darf nur vom Büro (inkl. Chef/Admin) gepflegt werden." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email } };
}

function revalidateWebsite(...paths: string[]) {
  revalidatePath("/website");
  revalidatePath("/", "layout");
  for (const p of paths) revalidatePath(p);
}

// ——— CMS-Seiten ——————————————————————————————————————————————————————————

const gueltigeOptionen = [
  { value: "SEITE", label: "Normale Seite" },
  { value: "START", label: "Startseite" },
  { value: "SPRACHE", label: "Sprachseite" },
] as const;

/** Prüft und normalisiert die Formular-Eingaben einer Seite (DE Pflicht, EN optional). */
function seiteEingaben(formData: FormData): {
  ok: true;
  values: {
    slug: string;
    typ: "SEITE" | "START" | "SPRACHE";
    inNavigation: boolean;
    navSortOrder: number;
    imFuss: boolean;
    active: boolean;
    de: UebersetzungEingaben;
    en: UebersetzungEingaben | null;
  };
} | { ok: false; state: FormState } {
  const slug = str(formData, "slug").toLowerCase().replace(/\/+$/, "");
  const typ = (str(formData, "typ") || "SEITE") as "SEITE" | "START" | "SPRACHE";
  const inNavigation = formData.get("inNavigation") === "on" || formData.get("inNavigation") === "true";
  const imFuss = formData.get("imFuss") === "on" || formData.get("imFuss") === "true";
  const active = formData.get("active") === "on" || formData.get("active") === "true";
  const navSortOrderRaw = str(formData, "navSortOrder");
  const navSortOrder = navSortOrderRaw === "" ? 0 : Number.parseInt(navSortOrderRaw, 10);

  const de: UebersetzungEingaben = {
    titel: str(formData, "titel_de"),
    untertitel: str(formData, "untertitel_de") || null,
    inhalt: str(formData, "inhalt_de"),
    seoTitel: str(formData, "seo_titel_de") || null,
    seoBeschreibung: str(formData, "seo_beschreibung_de") || null,
  };
  const enRoh: UebersetzungEingaben = {
    titel: str(formData, "titel_en"),
    untertitel: str(formData, "untertitel_en") || null,
    inhalt: str(formData, "inhalt_en"),
    seoTitel: str(formData, "seo_titel_en") || null,
    seoBeschreibung: str(formData, "seo_beschreibung_en") || null,
  };

  const fieldErrors: Record<string, string> = {};
  if (!istGueltigerSlug(slug) || istSlugVerboten(slug)) {
    fieldErrors.slug = "Kleinschreibung, Ziffern, Bindestrich; z.B. «ueber-uns» oder «sprachen/weitere». Reservierte Pfade sind nicht erlaubt.";
  }
  if (!gueltigeOptionen.some((o) => o.value === typ)) fieldErrors.typ = "Ungültiger Seitentyp.";
  if (!de.titel) fieldErrors["titel_de"] = "Bitte einen Titel (DE) angeben";
  if (!de.inhalt) fieldErrors["inhalt_de"] = "Bitte einen Inhalt (DE) angeben";
  if (Number.isNaN(navSortOrder) || navSortOrder < 0) fieldErrors.navSortOrder = "Zahl ≥ 0";
  // EN: entweder ganz leer (Fällt zurück auf DE) oder Titel + Inhalt Pflicht.
  const enLeer = !enRoh.titel && !enRoh.inhalt && !enRoh.untertitel && !enRoh.seoTitel && !enRoh.seoBeschreibung;
  if (!enLeer && (!enRoh.titel || !enRoh.inhalt)) {
    fieldErrors["titel_en"] = "Für die EN-Fassung Titel und Inhalt angeben — oder alle EN-Felder leer lassen (Fallback auf DE).";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { error: "Bitte prüfen Sie die Eingaben.", fieldErrors } };
  }
  return {
    ok: true,
    values: { slug, typ, inNavigation, navSortOrder, imFuss, active, de, en: enLeer ? null : enRoh },
  };
}

export async function speichereSeiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireWebsiteManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const eingaben = seiteEingaben(formData);
  if (!eingaben.ok) return eingaben.state;
  const { slug, typ, inNavigation, navSortOrder, imFuss, active, de, en } = eingaben.values;

  // Startseiten-/Sprachseiten-Sonderregeln: Typ und Slug bleiben fix, wenn
  // die Seite sie festlegt (keine doppelten Sprachseiten, Start bleibt Start).
  const bestehend = id ? await db.orm.public.WebsiteSeite.where({ id }).first() : null;
  const finalTyp = bestehend && bestehend.typ !== "SEITE" ? bestehend.typ : typ;
  const finalSlug = bestehend && bestehend.typ === "START" ? bestehend.slug : slug;

  try {
    const seite = id
      ? await db.orm.public.WebsiteSeite.where({ id }).update({
          slug: finalSlug,
          typ: finalTyp,
          inNavigation,
          navSortOrder,
          imFuss,
          active,
        })
      : await db.orm.public.WebsiteSeite.create({
          slug: finalSlug,
          typ: finalTyp,
          inNavigation,
          navSortOrder,
          imFuss,
          active,
        });
    if (!seite) return { error: "Seite nicht gefunden." };

    // DE ist Pflicht: bestehende Zeile updaten, sonst anlegen (Upsert).
    const deZeile = await db.orm.public.WebsiteSeiteUebersetzung
      .where((u) => u.seiteId.eq(seite.id))
      .where((u) => u.locale.eq("DE"))
      .first();
    const deDaten = {
      titel: de.titel,
      untertitel: de.untertitel,
      inhalt: de.inhalt,
      seoTitel: de.seoTitel,
      seoBeschreibung: de.seoBeschreibung,
    };
    if (deZeile) {
      await db.orm.public.WebsiteSeiteUebersetzung.where({ id: deZeile.id }).update(deDaten);
    } else {
      await db.orm.public.WebsiteSeiteUebersetzung.create({ seiteId: seite.id, locale: "DE", ...deDaten });
    }
    const enZeile = await db.orm.public.WebsiteSeiteUebersetzung
      .where((u) => u.seiteId.eq(seite.id))
      .where((u) => u.locale.eq("EN"))
      .first();
    if (en) {
      if (enZeile) {
        await db.orm.public.WebsiteSeiteUebersetzung.where({ id: enZeile.id }).update({
          titel: en.titel,
          untertitel: en.untertitel,
          inhalt: en.inhalt,
          seoTitel: en.seoTitel,
          seoBeschreibung: en.seoBeschreibung,
        });
      } else {
        await db.orm.public.WebsiteSeiteUebersetzung.create({
          seiteId: seite.id,
          locale: "EN",
          titel: en.titel,
          untertitel: en.untertitel,
          inhalt: en.inhalt,
          seoTitel: en.seoTitel,
          seoBeschreibung: en.seoBeschreibung,
        });
      }
    } else if (enZeile) {
      await db.orm.public.WebsiteSeiteUebersetzung.where({ id: enZeile.id }).delete();
    }

    await recordAudit({
      actor,
      action: "website.seite.speichern",
      entity: "WebsiteSeite",
      entityId: seite.id,
      summary: `Website-Seite «${finalSlug}» (EN ${en ? "ja" : "Fallback DE"}) ${id ? "geändert" : "angelegt"}`,
      details: { slug: finalSlug, typ: finalTyp, inNavigation, imFuss, active, en: Boolean(en) },
    });
    revalidateWebsite(`/website/seite/${seite.id}`);
    return { success: id ? "Seite gespeichert." : `Seite «${finalSlug}» angelegt.` };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Dieser Slug ist bereits vergeben.", fieldErrors: { slug: "Slug existiert bereits" } };
    }
    console.error("Website-Seite speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function loescheSeiteAction(formData: FormData): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageWebsite(ctx.user.roles as Role[])) {
    return; // Bewusst stumm: nichts löschen ohne Rechte.
  }
  const id = str(formData, "id");
  if (!id) return;
  const seite = await db.orm.public.WebsiteSeite.where({ id }).first();
  if (!seite || seite.typ === "START") return; // Startseite bleibt immer bestehen.

  await db.orm.public.WebsiteSeite.where({ id }).delete();
  await recordAudit({
    actor: { id: ctx.user.id, email: ctx.user.email },
    action: "website.seite.loeschen",
    entity: "WebsiteSeite",
    entityId: id,
    summary: `Website-Seite «${seite.slug}» gelöscht`,
  });
  revalidateWebsite();
  redirect("/website");
}

// ——— Pop-up ——————————————————————————————————————————————————————————————

interface UebersetzungEingaben {
  titel: string;
  untertitel: string | null;
  inhalt: string;
  seoTitel: string | null;
  seoBeschreibung: string | null;
}

/** «2026-11-03T18:00» (datetime-local) → UTC-Instant-String oder null. */
function zeitEingabe(raw: string): string | null | "ungueltig" {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return "ungueltig";
  const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
  const zeit = `${match[4]}:${match[5]}`;
  try {
    return toDbTime(zonedTimeToUtc(dateKey, zeit));
  } catch {
    return "ungueltig";
  }
}

export async function speicherePopupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireWebsiteManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const titel = str(formData, "titel");
  const text = str(formData, "text");
  const bildUrl = str(formData, "bildUrl") || null;
  const buttonLabel = str(formData, "buttonLabel") || null;
  const buttonUrl = str(formData, "buttonUrl") || null;
  const aktiv = formData.get("aktiv") === "on" || formData.get("aktiv") === "true";
  const vonRaw = zeitEingabe(str(formData, "gueltigVon"));
  const bisRaw = zeitEingabe(str(formData, "gueltigBis"));

  const fieldErrors: Record<string, string> = {};
  if (!titel) fieldErrors.titel = "Bitte einen Titel angeben";
  if (!text) fieldErrors.text = "Bitte einen Text angeben";
  if (vonRaw === "ungueltig") fieldErrors.gueltigVon = "Ungültiges Datum/Uhrzeit";
  if (bisRaw === "ungueltig") fieldErrors.gueltigBis = "Ungültiges Datum/Uhrzeit";
  if (typeof vonRaw === "string" && typeof bisRaw === "string" && vonRaw && bisRaw && vonRaw >= bisRaw) {
    fieldErrors.gueltigBis = "«Gültig bis» muss nach «Gültig von» liegen";
  }
  if (buttonLabel && !buttonUrl) fieldErrors.buttonUrl = "Button braucht eine URL (oder Button-Label entfernen)";
  if (buttonUrl && !buttonLabel) fieldErrors.buttonLabel = "URL ohne Label — bitte Button-Text angeben";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  try {
    const daten = {
      titel,
      text,
      bildUrl,
      buttonLabel,
      buttonUrl,
      aktiv,
      gueltigVon: vonRaw,
      gueltigBis: bisRaw,
    };
    const row = id
      ? await db.orm.public.WebsitePopup.where({ id }).update(daten)
      : await db.orm.public.WebsitePopup.create(daten);
    await recordAudit({
      actor,
      action: "website.popup.speichern",
      entity: "WebsitePopup",
      entityId: row?.id ?? id,
      summary: `Pop-up «${titel}» ${id ? "geändert" : "angelegt"} (${aktiv ? "aktiv" : "inaktiv"}${vonRaw ? ", von " + vonRaw : ""}${bisRaw ? ", bis " + bisRaw : ""})`,
      details: { aktiv, gueltigVon: vonRaw, gueltigBis: bisRaw },
    });
    revalidateWebsite();
    return { success: id ? "Pop-up gespeichert." : "Pop-up angelegt." };
  } catch (error) {
    console.error("Pop-up speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function loeschePopupAction(formData: FormData): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageWebsite(ctx.user.roles as Role[])) return;
  const id = str(formData, "id");
  if (!id) return;
  const popup = await db.orm.public.WebsitePopup.where({ id }).first();
  if (!popup) return;
  await db.orm.public.WebsitePopup.where({ id }).delete();
  await recordAudit({
    actor: { id: ctx.user.id, email: ctx.user.email },
    action: "website.popup.loeschen",
    entity: "WebsitePopup",
    entityId: id,
    summary: `Pop-up «${popup.titel}» gelöscht`,
  });
  revalidateWebsite();
  redirect("/website");
}

/**
 * «Pop-up geschlossen» → Cookie für einen Tag. Das Pop-up wird serverseitig
 * (SSR) weggelassen, wenn der Cookie gesetzt ist — kein Flackern beim Laden.
 */
export async function popupSchliessenAction(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(`popup_geschlossen_${id}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
}
