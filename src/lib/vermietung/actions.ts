"use server";

// Raumvermietung (Modul 12, Server-Actions): Mieterkartei (Löschschutz bei
// Vermietungen/Rechnungen, sonst archivieren), einmalige Vermietungen,
// Serien (materialisieren beim Anlegen direkt in Termine) und der
// Rechnungs-Entwurf über das Modul-9-System (Empfänger = Mieter). Keine
// harte Konfliktblockade — Doppelbelegungen meldet der weiche Hinweis und
// der Planer markiert farblich. Alles im Audit-Log (vermietung.*).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, fromDbTime, toDbTime, type Role } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageVermietung } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { betragString, betragZahl } from "@/lib/rechnungen/logik";
import { empfaengerVonMieter, erstelleRechnung } from "@/lib/rechnungen/erstellung";
import { normalizeTimeInput } from "@/lib/stammdaten/tarif";
import {
  formatDatum,
  minuteOfDay,
  parseDateKey,
  timeFromMinutes,
  utcToZoned,
  weekdayOfDateKey,
  WOCHENTAG_NAMEN,
  zonedTimeToUtc,
} from "@/lib/zeit";
import {
  dauerMinutenAusZeitfenster,
  istImPlanerFenster,
  serienTermine,
  ueberlappt,
  vermietungsPositionText,
} from "./logik";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function requireVermietungManager(): Promise<
  { actor: { id: string; email: string; name: string } } | { failure: FormState }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  const rollen = ((ctx.user.roles as (Role | null)[] | null) ?? []).filter((r): r is Role => r !== null);
  if (!canManageVermietung(rollen)) {
    return { failure: { error: "Die Raumvermietung ist Admin, Chef und Büro vorbehalten." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email, name: `${ctx.user.firstName} ${ctx.user.lastName}` } };
}

function revalidateVermietung(...paths: string[]) {
  revalidatePath("/vermietungen");
  revalidatePath("/vermietungen/mieter");
  revalidatePath("/planer");
  revalidatePath("/dashboard");
  revalidatePath("/rechnungen");
  for (const p of paths) revalidatePath(p);
}

/**
 * Weicher Belegungshinweis (keine Blockade, Muster Planer-Konflikte): prüft,
 * ob der Raum im gewünschten Fenster bereits von Lektionen oder anderen
 * Vermietungen belegt ist. Abgesagte Lektionen/Vermietungen zählen nicht.
 */
async function belegungshinweis(
  raumId: string,
  tagKey: string,
  startZeit: string,
  endZeit: string,
  ignoreVermietungId?: string | null,
): Promise<string | null> {
  const vonMin = minuteOfDay(startZeit);
  const bisMin = minuteOfDay(endZeit);
  if (vonMin === null || bisMin === null) return null;
  const fensterStart = zonedTimeToUtc(tagKey, startZeit);
  // Vorher beginnende Termine abdecken (max. Kursdauer 240 Min).
  const suchStart = new Date(fensterStart.getTime() - 240 * 60_000);
  const fensterEnde = zonedTimeToUtc(tagKey, endZeit);

  const hinweise: string[] = [];
  const lektionen = await db.orm.public.Lektion
    .where((l) => l.raumId.eq(raumId))
    .where((l) => l.startAt.gte(toDbTime(suchStart)))
    .where((l) => l.startAt.lt(toDbTime(fensterEnde)))
    .where((l) => l.status.in(["PROVISORISCH", "FIXIERT", "DURCHGEFUEHRT"]))
    .include("kurs")
    .all();
  for (const l of lektionen) {
    const local = utcToZoned(fromDbTime(l.startAt));
    if (local.dateKey !== tagKey) continue;
    if (!ueberlappt(vonMin, bisMin, local.minuteOfDay, local.minuteOfDay + l.dauerMinuten)) continue;
    hinweise.push(
      `Kurs ${l.kurs.code} (${timeFromMinutes(local.minuteOfDay)}–${timeFromMinutes(local.minuteOfDay + l.dauerMinuten)})`,
    );
  }

  const vermietungen = await db.orm.public.Vermietung
    .where((v) => v.raumId.eq(raumId))
    .where((v) => v.startAt.gte(toDbTime(suchStart)))
    .where((v) => v.startAt.lt(toDbTime(fensterEnde)))
    .where((v) => v.status.in(["GEPLANT", "FINDET_STATT"]))
    .include("mieter")
    .all();
  for (const v of vermietungen) {
    if (ignoreVermietungId && v.id === ignoreVermietungId) continue;
    const local = utcToZoned(fromDbTime(v.startAt));
    if (local.dateKey !== tagKey) continue;
    if (!ueberlappt(vonMin, bisMin, local.minuteOfDay, local.minuteOfDay + v.dauerMinuten)) continue;
    hinweise.push(
      `Vermietung ${v.mieter.name} (${timeFromMinutes(local.minuteOfDay)}–${timeFromMinutes(local.minuteOfDay + v.dauerMinuten)})`,
    );
  }

  if (hinweise.length === 0) return null;
  return `Hinweis: Der Raum ist im Zeitfenster bereits belegt — ${hinweise.join(" · ")}. Gespeichert wird trotzdem (Doppelbelegung wird im Planer markiert).`;
}

// ——— Mieterkartei ————————————————————————————————————————————————————

export async function saveMieterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const name = str(formData, "name");
  const email = str(formData, "email") || null;
  const telefon = str(formData, "telefon") || null;
  const strasse = str(formData, "strasse");
  const plz = str(formData, "plz");
  const ort = str(formData, "ort");
  const notiz = str(formData, "notiz") || null;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Pflichtfeld";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Ungültige E-Mail";
  if (!strasse) fieldErrors.strasse = "Pflichtfeld (Rechnungsadresse)";
  if (!plz) fieldErrors.plz = "Pflichtfeld";
  if (!ort) fieldErrors.ort = "Pflichtfeld";
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const daten = { name, email, telefon, strasse, plz, ort, notiz };
  try {
    if (id) {
      const bestehend = await db.orm.public.VermietungMieter.where({ id }).first();
      if (!bestehend) return { error: "Mieter nicht gefunden." };
      await db.orm.public.VermietungMieter.where({ id }).update(daten);
      await recordAudit({
        actor,
        action: "vermietung.mieter_geaendert",
        entity: "vermietung_mieter",
        entityId: id,
        summary: `Mieter «${name}» geändert`,
        details: daten,
      });
      revalidateVermietung("/vermietungen");
      return { success: `Mieter «${name}» gespeichert.` };
    }
    const created = await db.orm.public.VermietungMieter.create(daten);
    await recordAudit({
      actor,
      action: "vermietung.mieter_erstellt",
      entity: "vermietung_mieter",
      entityId: created.id,
      summary: `Mieter «${name}» angelegt`,
      details: daten,
    });
    revalidateVermietung("/vermietungen");
    return { success: `Mieter «${name}» angelegt.` };
  } catch (error) {
    console.error("Mieter speichern fehlgeschlagen:", error);
    return { error: "Speichern fehlgeschlagen." };
  }
}

export async function archiviereMieterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const archiviert = str(formData, "archiviert") === "true";
  const mieter = await db.orm.public.VermietungMieter.where({ id }).first();
  if (!mieter) return { error: "Mieter nicht gefunden." };

  await db.orm.public.VermietungMieter.where({ id }).update({
    active: !archiviert,
    archivedAt: archiviert ? toDbTime(new Date()) : null,
  });
  await recordAudit({
    actor,
    action: "vermietung.mieter_archiviert",
    entity: "vermietung_mieter",
    entityId: id,
    summary: `Mieter «${mieter.name}» ${archiviert ? "archiviert" : "reaktiviert"}`,
  });
  revalidateVermietung("/vermietungen");
  return { success: `Mieter «${mieter.name}» ${archiviert ? "archiviert" : "reaktiviert"}.` };
}

export async function loescheMieterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id");
  const mieter = await db.orm.public.VermietungMieter.where({ id }).first();
  if (!mieter) return { error: "Mieter nicht gefunden." };

  // Löschschutz (Pflichtenheft): mit Vermietungen, Serien oder Rechnungen
  // bleibt die Kartei bestehen — archivieren stattdessen.
  const [vermietungen, serien, rechnungen] = await Promise.all([
    db.orm.public.Vermietung.where({ mieterId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.VermietungSerie.where({ mieterId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
    db.orm.public.Rechnung.where({ mieterId: id }).aggregate((a) => ({ n: a.count() })).then((r) => r.n),
  ]);
  const genutzt = vermietungen + serien + rechnungen;
  if (genutzt > 0) {
    return {
      error:
        `«${mieter.name}» ist in Benutzung (${vermietungen} Vermietungen, ${serien} Serien, ${rechnungen} Rechnungen) ` +
        "— bitte archivieren statt löschen.",
    };
  }

  await db.orm.public.VermietungMieter.where({ id }).delete();
  await recordAudit({
    actor,
    action: "vermietung.mieter_geloescht",
    entity: "vermietung_mieter",
    entityId: id,
    summary: `Mieter «${mieter.name}» gelöscht (ohne Vermietungen/Rechnungen)`,
  });
  revalidateVermietung("/vermietungen");
  return { success: `Mieter «${mieter.name}» gelöscht.` };
}

// ——— Vermietungen (einzelne Termine) ——————————————————————————————————

/** Prüf- und Leselogik für das Vermietungs-Formular (gemeinsam neu/edit). */
async function leseVermietungFormular(formData: FormData): Promise<
  { daten: {
      mieterId: string;
      raumId: string;
      datum: string;
      startZeit: string;
      endZeit: string;
      dauerMinuten: number;
      preisChf: string;
      status: "GEPLANT" | "FINDET_STATT";
      notiz: string | null;
    };
  } | { failure: FormState }
> {
  const mieterId = str(formData, "mieterId");
  const raumId = str(formData, "raumId");
  const datum = str(formData, "datum");
  const startZeit = normalizeTimeInput(str(formData, "startZeit"));
  const endZeit = normalizeTimeInput(str(formData, "endZeit"));
  const preis = betragZahl(str(formData, "preisChf"));
  const statusRaw = str(formData, "status");
  const notiz = str(formData, "notiz") || null;

  const fieldErrors: Record<string, string> = {};
  if (!mieterId) fieldErrors.mieterId = "Mieter wählen";
  if (!raumId) fieldErrors.raumId = "Raum wählen";
  if (!parseDateKey(datum)) {
    fieldErrors.datum = "Gültiges Datum wählen";
  } else if (weekdayOfDateKey(datum) === 7) {
    fieldErrors.datum = "Sonntag — der Planer umfasst Mo–Sa";
  }
  if (!(preis > 0) || preis > 999_999) fieldErrors.preisChf = "Preis in CHF angeben";
  if (!startZeit || !endZeit) {
    fieldErrors.endZeit = "Zeitfenster angeben (Ende nach Start)";
  } else {
    const dauer = dauerMinutenAusZeitfenster(startZeit, endZeit);
    if (dauer === null) fieldErrors.endZeit = "Ende muss nach dem Start liegen";
    else if (!istImPlanerFenster(startZeit, endZeit)) fieldErrors.startZeit = "Fenster im Planer-Raster 06:30–23:00";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { failure: { error: "Bitte prüfen Sie die Eingaben.", fieldErrors } };
  }

  return {
    daten: {
      mieterId,
      raumId,
      datum,
      startZeit: startZeit!,
      endZeit: endZeit!,
      dauerMinuten: dauerMinutenAusZeitfenster(startZeit!, endZeit!)!,
      preisChf: betragString(preis),
      status: statusRaw === "FINDET_STATT" ? "FINDET_STATT" : "GEPLANT",
      notiz,
    },
  };
}

export async function saveVermietungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const gelesen = await leseVermietungFormular(formData);
  if ("failure" in gelesen) return gelesen.failure;
  const { mieterId, raumId, datum, startZeit, endZeit, dauerMinuten, preisChf, status, notiz } = gelesen.daten;

  const mieter = await db.orm.public.VermietungMieter.where({ id: mieterId }).first();
  if (!mieter) return { error: "Mieter nicht gefunden." };
  const raum = await db.orm.public.Raum.where({ id: raumId }).first();
  if (!raum) return { error: "Raum nicht gefunden." };

  const startAt = zonedTimeToUtc(datum, startZeit);
  const hinweis = await belegungshinweis(raumId, datum, startZeit, endZeit, id);

  if (id) {
    const bestehend = await db.orm.public.Vermietung.where({ id }).first();
    if (!bestehend) return { error: "Vermietung nicht gefunden." };
    if (bestehend.rechnungId) {
      return { error: "Für diese Vermietung existiert bereits eine Rechnung — bitte zuerst den Rechnungs-Entwurf löschen." };
    }
    await db.orm.public.Vermietung.where({ id }).update({
      mieterId,
      raumId,
      startAt: toDbTime(startAt),
      dauerMinuten,
      preisChf,
      status,
      notiz,
    });
    await recordAudit({
      actor,
      action: "vermietung.geaendert",
      entity: "vermietung",
      entityId: id,
      summary: `Vermietung geändert: ${mieter.name}, Raum ${raum.name}, ${formatDatum(datum)} ${startZeit}–${endZeit} (${preisChf} CHF, ${status === "FINDET_STATT" ? "findet statt" : "geplant"})`,
      details: { mieterId, raumId, datum, startZeit, endZeit, preisChf, status, notiz },
    });
    revalidateVermietung(`/vermietungen/${id}`);
    return { success: `Vermietung gespeichert.${hinweis ? ` ${hinweis}` : ""}` };
  }

  const created = await db.orm.public.Vermietung.create({
    mieterId,
    raumId,
    startAt: toDbTime(startAt),
    dauerMinuten,
    preisChf,
    status: "GEPLANT",
    notiz,
  });
  await recordAudit({
    actor,
    action: "vermietung.erstellt",
    entity: "vermietung",
    entityId: created.id,
    summary: `Vermietung angelegt: ${mieter.name}, Raum ${raum.name}, ${formatDatum(datum)} ${startZeit}–${endZeit} (${preisChf} CHF)`,
    details: { mieterId, raumId, datum, startZeit, endZeit, preisChf, notiz },
  });
  revalidateVermietung(`/vermietungen/${created.id}`);
  return { success: `Vermietung angelegt.${hinweis ? ` ${hinweis}` : ""}` };
}

/** Status wechseln zwischen «geplant» und «findet statt» (Absage separat). */
export async function aendereVermietungStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "vermietungId");
  const status = str(formData, "status");
  if (status !== "GEPLANT" && status !== "FINDET_STATT") {
    return { error: "Ungültiger Status (Absagen laufen separat)." };
  }
  const vermietung = await db.orm.public.Vermietung.where({ id }).include("mieter").first();
  if (!vermietung) return { error: "Vermietung nicht gefunden." };
  if (vermietung.status === "ABGESAGT") {
    return { error: "Die Vermietung ist abgesagt — für die Reaktivierung bitte neu erfassen." };
  }

  await db.orm.public.Vermietung.where({ id }).update({ status });
  await recordAudit({
    actor,
    action: "vermietung.status",
    entity: "vermietung",
    entityId: id,
    summary: `Vermietung (${vermietung.mieter.name}) → ${status === "FINDET_STATT" ? "findet statt" : "geplant"}`,
  });
  revalidateVermietung(`/vermietungen/${id}`);
  return { success: `Status gesetzt: ${status === "FINDET_STATT" ? "findet statt" : "geplant"}.` };
}

export async function sageVermietungAbAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "vermietungId");
  const grund = str(formData, "grund");
  if (!grund) return { error: "Bitte einen Absage-Grund angeben.", fieldErrors: { grund: "Pflichtfeld" } };
  const vermietung = await db.orm.public.Vermietung.where({ id }).include("mieter").first();
  if (!vermietung) return { error: "Vermietung nicht gefunden." };
  if (vermietung.status === "ABGESAGT") return { error: "Die Vermietung ist bereits abgesagt." };

  await db.orm.public.Vermietung.where({ id }).update({ status: "ABGESAGT", absageGrund: grund });
  const hinweisRechnung = vermietung.rechnungId
    ? " Achtung: Es existiert eine Rechnung — bitte dort stornieren bzw. den Entwurf löschen."
    : "";
  await recordAudit({
    actor,
    action: "vermietung.absage",
    entity: "vermietung",
    entityId: id,
    summary: `Vermietung (${vermietung.mieter.name}) abgesagt — Grund: ${grund}`,
    details: { grund },
  });
  revalidateVermietung(`/vermietungen/${id}`);
  return { success: `Vermietung abgesagt (im Planer ausgegraut).${hinweisRechnung}` };
}

export async function loescheVermietungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "vermietungId");
  const vermietung = await db.orm.public.Vermietung.where({ id }).include("mieter").first();
  if (!vermietung) return { error: "Vermietung nicht gefunden." };
  if (vermietung.rechnungId) {
    return { error: "Für diese Vermietung existiert eine Rechnung — bitte zuerst dort stornieren bzw. den Entwurf löschen." };
  }

  await db.orm.public.Vermietung.where({ id }).delete();
  await recordAudit({
    actor,
    action: "vermietung.geloescht",
    entity: "vermietung",
    entityId: id,
    summary: `Vermietung gelöscht: ${vermietung.mieter.name} (${vermietung.status === "ABGESAGT" ? "war abgesagt" : vermietung.status})`,
  });
  revalidateVermietung();
  redirect("/vermietungen");
}

// ——— Serien ——————————————————————————————————————————————————————————

export async function saveSerieAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const mieterId = str(formData, "mieterId");
  const raumId = str(formData, "raumId");
  const wochentagRaw = Number.parseInt(str(formData, "wochentag"), 10);
  const startZeit = normalizeTimeInput(str(formData, "startZeit"));
  const endZeit = normalizeTimeInput(str(formData, "endZeit"));
  const von = str(formData, "von");
  const bis = str(formData, "bis");
  const preis = betragZahl(str(formData, "preisChf"));
  const notiz = str(formData, "notiz") || null;

  const fieldErrors: Record<string, string> = {};
  if (!mieterId) fieldErrors.mieterId = "Mieter wählen";
  if (!raumId) fieldErrors.raumId = "Raum wählen";
  if (!Number.isInteger(wochentagRaw) || wochentagRaw < 1 || wochentagRaw > 6) {
    fieldErrors.wochentag = "Wochentag wählen (Montag–Samstag)";
  }
  if (!(preis > 0) || preis > 999_999) fieldErrors.preisChf = "Preis pro Termin in CHF angeben";
  if (!parseDateKey(von)) fieldErrors.von = "Zeitraum von";
  if (!parseDateKey(bis)) fieldErrors.bis = "Zeitraum bis";
  if (parseDateKey(von) && parseDateKey(bis) && bis < von) {
    fieldErrors.bis = "Bis liegt vor Von";
  }
  if (!startZeit || !endZeit) {
    fieldErrors.endZeit = "Zeitfenster angeben (Ende nach Start)";
  } else {
    const dauer = dauerMinutenAusZeitfenster(startZeit, endZeit);
    if (dauer === null) fieldErrors.endZeit = "Ende muss nach dem Start liegen";
    else if (!istImPlanerFenster(startZeit, endZeit)) fieldErrors.startZeit = "Fenster im Planer-Raster 06:30–23:00";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };
  }

  const mieter = await db.orm.public.VermietungMieter.where({ id: mieterId }).first();
  if (!mieter) return { error: "Mieter nicht gefunden." };
  const raum = await db.orm.public.Raum.where({ id: raumId }).first();
  if (!raum) return { error: "Raum nicht gefunden." };

  const dauerMinuten = dauerMinutenAusZeitfenster(startZeit!, endZeit!)!;
  const termine = serienTermine(wochentagRaw, von, bis);
  if (termine.length === 0) {
    return { error: `Im Zeitraum ${formatDatum(von)}–${formatDatum(bis)} liegt kein ${WOCHENTAG_NAMEN[wochentagRaw - 1]}.` };
  }

  const serie = await db.orm.public.VermietungSerie.create({
    mieterId,
    raumId,
    wochentag: wochentagRaw,
    startZeit: startZeit!,
    endZeit: endZeit!,
    von: toDbTime(new Date(`${von}T00:00:00Z`)),
    bis: toDbTime(new Date(`${bis}T00:00:00Z`)),
    preisChf: betragString(preis),
    notiz,
  });
  for (const terminKey of termine) {
    await db.orm.public.Vermietung.create({
      mieterId,
      raumId,
      startAt: toDbTime(zonedTimeToUtc(terminKey, startZeit!)),
      dauerMinuten,
      preisChf: betragString(preis),
      status: "GEPLANT",
      serieId: serie.id,
      notiz,
    });
  }

  await recordAudit({
    actor,
    action: "vermietung.serie_erstellt",
    entity: "vermietung_serie",
    entityId: serie.id,
    summary: `Vermietungs-Serie angelegt: ${mieter.name}, Raum ${raum.name}, jeden ${WOCHENTAG_NAMEN[wochentagRaw - 1]} ${startZeit}–${endZeit}, ${formatDatum(von)}–${formatDatum(bis)} — ${termine.length} Termine materialisiert`,
    details: { mieterId, raumId, wochentag: wochentagRaw, von, bis, preisChf: betragString(preis), termine: termine.length },
  });
  revalidateVermietung();
  return {
    success: `Serie angelegt — ${termine.length} Termine (jeden ${WOCHENTAG_NAMEN[wochentagRaw - 1]}, ${formatDatum(termine[0]!)}–${formatDatum(termine[termine.length - 1]!)}).`,
  };
}

export async function loescheSerieAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const serieId = str(formData, "serieId");
  const serie = await db.orm.public.VermietungSerie.where({ id: serieId }).include("mieter").first();
  if (!serie) return { error: "Serie nicht gefunden." };

  // Geplante Termine ohne Rechnung mitlöschen; bereits bestätigte,
  // abgesagte oder abgerechnete Termine bleiben bestehen (serieId → null).
  const termine = await db.orm.public.Vermietung.where({ serieId }).all();
  const loeschbar = termine.filter((t) => t.status === "GEPLANT" && !t.rechnungId);
  for (const t of loeschbar) {
    await db.orm.public.Vermietung.where({ id: t.id }).delete();
  }
  await db.orm.public.VermietungSerie.where({ id: serieId }).delete();

  await recordAudit({
    actor,
    action: "vermietung.serie_geloescht",
    entity: "vermietung_serie",
    entityId: serieId,
    summary: `Vermietungs-Serie (${serie.mieter.name}, ${formatDatum(String(serie.von).slice(0, 10))}–${formatDatum(String(serie.bis).slice(0, 10))}) gelöscht — ${loeschbar.length} geplante Termine entfernt, ${termine.length - loeschbar.length} bleiben`,
    details: { geloeschteTermine: loeschbar.length, verbleibendeTermine: termine.length - loeschbar.length },
  });
  revalidateVermietung();
  return {
    success: `Serie gelöscht — ${loeschbar.length} geplante Termine entfernt, ${termine.length - loeschbar.length} Termine (findet statt/abgesagt/mit Rechnung) bleiben bestehen.`,
  };
}

// ——— Rechnungs-Entwurf (Modul 9, Empfänger = Mieter) ——————————————————

export async function erstelleVermietungRechnungAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireVermietungManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const vermietungId = str(formData, "vermietungId");
  const vermietung = await db.orm.public.Vermietung
    .where({ id: vermietungId })
    .include("mieter")
    .include("raum")
    .first();
  if (!vermietung) return { error: "Vermietung nicht gefunden." };
  if (vermietung.rechnungId) return { error: "Für diese Vermietung existiert bereits eine Rechnung." };
  if (vermietung.status === "ABGESAGT") {
    return { error: "Abgesagte Vermietungen werden nicht abrechnet." };
  }

  const local = utcToZoned(fromDbTime(vermietung.startAt));
  const startZeit = timeFromMinutes(local.minuteOfDay);
  const endZeit = timeFromMinutes(local.minuteOfDay + vermietung.dauerMinuten);

  try {
    const created = await erstelleRechnung({
      empfaenger: empfaengerVonMieter({
        id: vermietung.mieter.id,
        name: vermietung.mieter.name,
        strasse: vermietung.mieter.strasse,
        plz: vermietung.mieter.plz,
        ort: vermietung.mieter.ort,
        email: vermietung.mieter.email,
      }),
      positionen: [
        {
          text: vermietungsPositionText(vermietung.raum.name, local.dateKey, startZeit, endZeit),
          menge: 1,
          einzelpreisChf: betragString(Number(vermietung.preisChf.toString())),
        },
      ],
      mwstSatzProzent: null,
      notiz: "Raumvermietung — Empfänger aus der Mieterkartei (Modul 12).",
    });
    await db.orm.public.Vermietung.where({ id: vermietung.id }).update({ rechnungId: created.id });
    await recordAudit({
      actor,
      action: "vermietung.rechnung_erstellt",
      entity: "vermietung",
      entityId: vermietung.id,
      summary: `Rechnungs-Entwurf ${created.nummer} für Vermietung erstellt (${vermietung.mieter.name}, Raum ${vermietung.raum.name}, ${formatDatum(local.dateKey)} ${startZeit}–${endZeit})`,
      details: { rechnungId: created.id, mieterId: vermietung.mieterId },
    });
    revalidateVermietung(`/vermietungen/${vermietung.id}`);
    return { success: `Rechnungs-Entwurf ${created.nummer} erstellt — Versand und Teilzahlungen laufen über die Rechnungsverwaltung.` };
  } catch (error) {
    console.error("Vermietungs-Rechnung fehlgeschlagen:", error);
    return { error: error instanceof Error ? error.message : "Rechnungs-Erstellung fehlgeschlagen." };
  }
}
