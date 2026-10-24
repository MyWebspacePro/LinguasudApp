"use server";

// Stammdaten-Server-Actions (Modul 2). Pflegen darf ausschliesslich Admin
// (Pflichtenheft); jede Aktion prüft das selbst. Globale Regel:
// anlegen · aktivieren/deaktivieren · löschen nur wenn unbenutzt · archivieren.

import { revalidatePath } from "next/cache";
import { Prisma, type KostentraegerArt, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/session";
import { canManageStammdaten } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { FormState } from "@/lib/forms";
import { normalizeTimeInput } from "./tarif";

// ——— Wächter —————————————————————————————————————————————————————

async function requireManager(): Promise<{ actor: { id: string; email: string } } | { failure: FormState }> {
  const ctx = await getAuthContext();
  if (!ctx) return { failure: { error: "Ihre Sitzung ist abgelaufen. Bitte erneut anmelden." } };
  if (ctx.user.mustChangePassword) return { failure: { error: "Bitte ändern Sie zuerst Ihr Passwort." } };
  if (!canManageStammdaten(ctx.user.roles as Role[])) {
    return { failure: { error: "Stammdaten darf nur die Verwaltung (Admin) pflegen." } };
  }
  return { actor: { id: ctx.user.id, email: ctx.user.email } };
}

function uniqueMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Dieser Name bzw. dieses Kürzel existiert bereits.";
  }
  return null;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string) => Number.parseInt(String(fd.get(key) ?? ""), 10);

function revalidateStammdaten(...paths: string[]) {
  revalidatePath("/stammdaten");
  revalidatePath("/dashboard");
  for (const p of paths) revalidatePath(p);
}

interface AuditRef {
  actor: { id: string; email: string };
  entity: string;
  entityId: string;
}

async function audited(ref: AuditRef, action: string, summary: string, details?: Prisma.InputJsonValue) {
  await recordAudit({ actor: ref.actor, action, entity: ref.entity, entityId: ref.entityId, summary, details });
}

// ——— Sprachen ————————————————————————————————————————————————————

export async function saveSpracheAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const name = str(formData, "name");
  const code = str(formData, "code").toUpperCase();
  if (name.length < 2) return { error: "Bitte einen Namen angeben.", fieldErrors: { name: "Mindestens 2 Zeichen" } };
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return { error: "Das Kürzel muss aus 2–3 Buchstaben bestehen.", fieldErrors: { code: "z.B. PT" } };
  }

  try {
    const row = id
      ? await prisma.sprache.update({ where: { id }, data: { name, code } })
      : await prisma.sprache.create({ data: { name, code } });
    await audited({ actor, entity: "sprache", entityId: row.id }, "sprache.update", `Sprache «${name}» (${code}) ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/sprachen");
    return { success: id ? "Sprache gespeichert." : `Sprache «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

// ——— Niveaus —————————————————————————————————————————————————————

export async function saveNiveauAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const code = str(formData, "code").toUpperCase();
  const name = str(formData, "name") || null;
  const sortOrder = Number.isNaN(int(formData, "sortOrder")) ? 0 : int(formData, "sortOrder");
  if (!/^[A-Z0-9.]{1,6}$/.test(code)) {
    return { error: "Ungültiger Niveau-Code.", fieldErrors: { code: "z.B. A1, B1.2" } };
  }

  try {
    const row = id
      ? await prisma.niveau.update({ where: { id }, data: { code, name, sortOrder } })
      : await prisma.niveau.create({ data: { code, name, sortOrder } });
    await audited({ actor, entity: "niveau", entityId: row.id }, "niveau.update", `Niveau «${code}» ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/niveaus");
    return { success: id ? "Niveau gespeichert." : `Niveau «${code}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

// ——— Kursarten ————————————————————————————————————————————————————

export async function saveKursartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const name = str(formData, "name");
  const rawMax = str(formData, "maxParticipants");
  const maxParticipants = rawMax === "" ? null : Number.parseInt(rawMax, 10);
  const requiresRoom = formData.get("requiresRoom") === "on" || formData.get("requiresRoom") === "true";
  const sortOrder = Number.isNaN(int(formData, "sortOrder")) ? 0 : int(formData, "sortOrder");

  if (name.length < 2) return { error: "Bitte einen Namen angeben.", fieldErrors: { name: "Mindestens 2 Zeichen" } };
  if (maxParticipants !== null && (Number.isNaN(maxParticipants) || maxParticipants < 1)) {
    return { error: "Ungültige Teilnehmerzahl.", fieldErrors: { maxParticipants: "Zahl ≥ 1 oder leer" } };
  }

  try {
    const data = { name, maxParticipants, requiresRoom, sortOrder };
    const row = id
      ? await prisma.kursart.update({ where: { id }, data })
      : await prisma.kursart.create({ data });
    await audited({ actor, entity: "kursart", entityId: row.id }, "kursart.update", `Kursart «${name}» ${id ? "geändert" : "angelegt"}`, { maxParticipants, requiresRoom });
    revalidateStammdaten("/stammdaten/kursarten", "/stammdaten/tarife");
    return { success: id ? "Kursart gespeichert." : `Kursart «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

// ——— Lektionsdauern ——————————————————————————————————————————————

export async function saveDauerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const minuten = int(formData, "minuten");
  if (Number.isNaN(minuten) || minuten < 15 || minuten > 600) {
    return { error: "Ungültige Dauer.", fieldErrors: { minuten: "15–600 Minuten" } };
  }

  try {
    const row = id
      ? await prisma.lektionsdauer.update({ where: { id }, data: { minuten } })
      : await prisma.lektionsdauer.create({ data: { minuten } });
    await audited({ actor, entity: "dauer", entityId: row.id }, "dauer.update", `Lektionsdauer ${minuten} Min. ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/dauern", "/stammdaten/tarife");
    return { success: id ? "Dauer gespeichert." : `Dauer ${minuten} Minuten angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

// ——— Tarifstufen ————————————————————————————————————————————————————

export async function saveTarifstufeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const name = str(formData, "name");
  const lessonsPerPackage = int(formData, "lessonsPerPackage");
  const times = {
    middayFrom: normalizeTimeInput(str(formData, "middayFrom")),
    middayTo: normalizeTimeInput(str(formData, "middayTo")),
    eveningFrom: normalizeTimeInput(str(formData, "eveningFrom")),
  };

  if (name.length < 2) return { error: "Bitte einen Namen angeben.", fieldErrors: { name: "Mindestens 2 Zeichen" } };
  if (Number.isNaN(lessonsPerPackage) || lessonsPerPackage < 1 || lessonsPerPackage > 100) {
    return { error: "Ungültige Paketgrösse.", fieldErrors: { lessonsPerPackage: "1–100 Lektionen" } };
  }
  for (const [field, raw] of [
    ["middayFrom", str(formData, "middayFrom")],
    ["middayTo", str(formData, "middayTo")],
    ["eveningFrom", str(formData, "eveningFrom")],
  ] as const) {
    if (raw !== "" && times[field as keyof typeof times] === null) {
      return { error: "Zeitfenster im Format HH:mm angeben.", fieldErrors: { [field]: "z.B. 11:30" } };
    }
  }
  if (times.middayFrom === null || times.middayTo === null) {
    // Beide oder keine Mittagszeit
    if (times.middayFrom !== times.middayTo) {
      return { error: "Mittagsfenster braucht von und bis.", fieldErrors: { middayFrom: "beide ausfüllen" } };
    }
  }

  try {
    const data = { name, lessonsPerPackage, ...times };
    const row = id
      ? await prisma.tarifstufe.update({ where: { id }, data })
      : await prisma.tarifstufe.create({ data });
    await audited({ actor, entity: "tarifstufe", entityId: row.id }, "tarifstufe.update", `Tarifstufe «${name}» (${lessonsPerPackage} Lektionen/Paket) ${id ? "geändert" : "angelegt"}`, { ...times });
    revalidateStammdaten("/stammdaten/tarife");
    return { success: id ? "Tarifstufe gespeichert." : `Tarifstufe «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

// ——— Kostenträger ————————————————————————————————————————————————————

export async function saveKostentraegerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const artRaw = str(formData, "art");
  const art: KostentraegerArt = artRaw === "OEFFENTLICHE_EINRICHTUNG" ? "OEFFENTLICHE_EINRICHTUNG" : "FIRMA";
  const name = str(formData, "name");
  const kundennummer = str(formData, "kundennummer");
  const adresse = {
    strasse: str(formData, "strasse"),
    plz: str(formData, "plz"),
    ort: str(formData, "ort"),
  };

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Mindestens 2 Zeichen";
  if (!kundennummer) fieldErrors.kundennummer = "Pflichtfeld";
  if (adresse.strasse.length < 2) fieldErrors.strasse = "Pflichtfeld";
  if (!adresse.plz) fieldErrors.plz = "Pflichtfeld";
  if (adresse.ort.length < 2) fieldErrors.ort = "Pflichtfeld";
  if (Object.keys(fieldErrors).length > 0) return { error: "Bitte prüfen Sie die Eingaben.", fieldErrors };

  try {
    const data = { art, name, kundennummer, ...adresse };
    const row = id
      ? await prisma.kostentraeger.update({ where: { id }, data })
      : await prisma.kostentraeger.create({ data });
    await audited({ actor, entity: "kostentraeger", entityId: row.id }, "kostentraeger.update", `Kostenträger «${name}» (${kundennummer}) ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/kostentraeger");
    return { success: id ? "Kostenträger gespeichert." : `Kostenträger «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen (Kundennummer bereits vergeben?)." };
  }
}

// ——— Standorte / Etagen / Räume ————————————————————————————————————

export async function saveStandortAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const data = {
    name: str(formData, "name"),
    strasse: str(formData, "strasse"),
    plz: str(formData, "plz"),
    ort: str(formData, "ort"),
  };
  if (data.name.length < 2 || data.strasse.length < 2 || !data.plz || data.ort.length < 2) {
    return { error: "Bitte alle Adressfelder ausfüllen." };
  }

  try {
    const row = id
      ? await prisma.standort.update({ where: { id }, data })
      : await prisma.standort.create({ data });
    await audited({ actor, entity: "standort", entityId: row.id }, "standort.update", `Standort «${data.name}» ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/standorte");
    return { success: id ? "Standort gespeichert." : `Standort «${data.name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen." };
  }
}

export async function saveEtageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const standortId = str(formData, "standortId");
  const name = str(formData, "name");
  const sortOrder = Number.isNaN(int(formData, "sortOrder")) ? 0 : int(formData, "sortOrder");
  if (!standortId) return { error: "Standort fehlt." };
  if (name.length < 1) return { error: "Bitte einen Namen angeben.", fieldErrors: { name: "z.B. 2. Stock" } };

  try {
    const row = id
      ? await prisma.etage.update({ where: { id }, data: { name, sortOrder } })
      : await prisma.etage.create({ data: { standortId, name, sortOrder } });
    await audited({ actor, entity: "etage", entityId: row.id }, "etage.update", `Etage «${name}» ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/standorte");
    return { success: id ? "Etage gespeichert." : `Etage «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen (Etage existiert bereits?)." };
  }
}

export async function saveRaumAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const id = str(formData, "id") || null;
  const etageId = str(formData, "etageId");
  const name = str(formData, "name");
  const seats = int(formData, "seats");
  if (!etageId) return { error: "Etage fehlt." };
  if (name.length < 1) return { error: "Bitte einen Raumnamen angeben.", fieldErrors: { name: "z.B. Oxford" } };
  if (Number.isNaN(seats) || seats < 0 || seats > 200) {
    return { error: "Ungültige Sitzplatzzahl.", fieldErrors: { seats: "0–200" } };
  }

  try {
    const row = id
      ? await prisma.raum.update({ where: { id }, data: { name, seats } })
      : await prisma.raum.create({ data: { etageId, name, seats } });
    await audited({ actor, entity: "raum", entityId: row.id }, "raum.update", `Raum «${name}» (${seats} Plätze) ${id ? "geändert" : "angelegt"}`);
    revalidateStammdaten("/stammdaten/standorte");
    return { success: id ? "Raum gespeichert." : `Raum «${name}» angelegt.` };
  } catch (error) {
    return { error: uniqueMessage(error) ?? "Speichern fehlgeschlagen (Raumname existiert bereits?)." };
  }
}

// ——— Preisliste (jederzeit anpassbar) ————————————————————————————

/** Setzt die komplette Preisliste (Kursart × Dauer × Tarifstufe) atomar. */
export async function savePreiseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  // Zellen heissen "p:<kursartId>:<dauerId>:<tarifstufeId>", Wert = CHF-Betrag.
  const cells: { kursartId: string; lektionsdauerId: string; tarifstufeId: string; amount: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("p:")) continue;
    const [, kursartId, dauerId, stufeId] = key.split(":");
    const text = String(raw).trim().replace(",", ".");
    if (text === "") continue;
    const amount = Number.parseFloat(text);
    if (Number.isNaN(amount) || amount < 0 || amount > 100000) {
      return { error: `Ungültiger Betrag «${String(raw)}» — bitte als Zahl eingeben (z.B. 85 oder 85.50).` };
    }
    cells.push({ kursartId, lektionsdauerId: dauerId, tarifstufeId: stufeId, amount });
  }

  try {
    await prisma.$transaction([
      prisma.preis.deleteMany({}),
      prisma.preis.createMany({
        data: cells.map((c) => ({
          kursartId: c.kursartId,
          lektionsdauerId: c.lektionsdauerId,
          tarifstufeId: c.tarifstufeId,
          amountChf: new Prisma.Decimal(c.amount.toFixed(2)),
        })),
      }),
    ]);
    await audited({ actor, entity: "preisliste", entityId: "matrix" }, "preisliste.update", `Preisliste gespeichert (${cells.length} Preise)`);
    revalidateStammdaten("/stammdaten/tarife");
    return { success: `Preisliste gespeichert (${cells.length} Preise). Leere Zellen wurden entfernt.` };
  } catch (error) {
    console.error("Preisliste speichern fehlgeschlagen:", error);
    return { error: uniqueMessage(error) ?? "Speichern der Preisliste fehlgeschlagen." };
  }
}

// ——— Generisch: aktivieren/deaktivieren, archivieren, löschen ——————

export type StammdatenEntity =
  | "sprache"
  | "niveau"
  | "kursart"
  | "dauer"
  | "tarifstufe"
  | "kostentraeger"
  | "standort"
  | "etage"
  | "raum";

interface EntityOps {
  label: (row: { id: string }) => Promise<string>;
  setActive: (id: string, active: boolean) => Promise<unknown>;
  setArchived: (id: string, archived: boolean) => Promise<unknown>;
  /** Löschen — wirft bei «benutzt» eine verständliche Meldung. */
  remove: (id: string) => Promise<void>;
}

const ENTITY_OPS: Record<StammdatenEntity, EntityOps> = {
  sprache: {
    label: async (r) => (await prisma.sprache.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.sprache.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.sprache.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      // Nutzung durch Kurse kommt mit Modul 4; dann hier blocken.
      await prisma.sprache.delete({ where: { id } });
    },
  },
  niveau: {
    label: async (r) => (await prisma.niveau.findUnique({ where: { id: r.id } }))?.code ?? r.id,
    setActive: (id, active) => prisma.niveau.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.niveau.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      await prisma.niveau.delete({ where: { id } });
    },
  },
  kursart: {
    label: async (r) => (await prisma.kursart.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.kursart.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.kursart.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      const preise = await prisma.preis.count({ where: { kursartId: id } });
      if (preise > 0) throw new Error("Diese Kursart hat Preise in der Preisliste — zuerst diese entfernen.");
      await prisma.kursart.delete({ where: { id } });
    },
  },
  dauer: {
    label: async (r) => {
      const row = await prisma.lektionsdauer.findUnique({ where: { id: r.id } });
      return row ? `${row.minuten} Min.` : r.id;
    },
    setActive: (id, active) => prisma.lektionsdauer.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.lektionsdauer.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      const preise = await prisma.preis.count({ where: { lektionsdauerId: id } });
      if (preise > 0) throw new Error("Diese Dauer hat Preise in der Preisliste — zuerst diese entfernen.");
      await prisma.lektionsdauer.delete({ where: { id } });
    },
  },
  tarifstufe: {
    label: async (r) => (await prisma.tarifstufe.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.tarifstufe.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.tarifstufe.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      const preise = await prisma.preis.count({ where: { tarifstufeId: id } });
      if (preise > 0) throw new Error("Diese Tarifstufe hat Preise in der Preisliste — zuerst diese entfernen.");
      await prisma.tarifstufe.delete({ where: { id } });
    },
  },
  kostentraeger: {
    label: async (r) => (await prisma.kostentraeger.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.kostentraeger.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.kostentraeger.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      // Nutzung durch Anmeldungen/Rechnungen kommt mit Modul 5/9.
      await prisma.kostentraeger.delete({ where: { id } });
    },
  },
  standort: {
    label: async (r) => (await prisma.standort.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.standort.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.standort.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      const etagen = await prisma.etage.count({ where: { standortId: id } });
      if (etagen > 0) throw new Error("Dieser Standort hat Etagen/Räume — zuerst diese löschen (oder den Standort archivieren).");
      await prisma.standort.delete({ where: { id } });
    },
  },
  etage: {
    label: async (r) => (await prisma.etage.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: () => {
      throw new Error("Etagen haben keinen eigenen Status.");
    },
    setArchived: () => {
      throw new Error("Etagen können nicht archiviert werden.");
    },
    remove: async (id) => {
      const raeume = await prisma.raum.count({ where: { etageId: id } });
      if (raeume > 0) throw new Error("Diese Etage hat Räume — zuerst diese löschen.");
      await prisma.etage.delete({ where: { id } });
    },
  },
  raum: {
    label: async (r) => (await prisma.raum.findUnique({ where: { id: r.id } }))?.name ?? r.id,
    setActive: (id, active) => prisma.raum.update({ where: { id }, data: { active } }),
    setArchived: (id, archived) =>
      prisma.raum.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } }),
    remove: async (id) => {
      // Nutzung durch Lektionen kommt mit Modul 6; dann hier blocken.
      await prisma.raum.delete({ where: { id } });
    },
  },
};

export async function setActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const entity = str(formData, "entity") as StammdatenEntity;
  const id = str(formData, "id");
  const active = str(formData, "active") === "true";
  const ops = ENTITY_OPS[entity];
  if (!ops || !id) return { error: "Ungültige Anfrage." };

  try {
    await ops.setActive(id, active);
    const label = await ops.label({ id });
    await audited({ actor, entity, entityId: id }, `${entity}.toggle`, `${label}: ${active ? "aktiviert" : "deaktiviert"}`);
    revalidateStammdaten();
    return { success: `${label} ${active ? "aktiviert" : "deaktiviert"}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Aktion fehlgeschlagen." };
  }
}

export async function setArchivedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const entity = str(formData, "entity") as StammdatenEntity;
  const id = str(formData, "id");
  const archived = str(formData, "archived") === "true";
  const ops = ENTITY_OPS[entity];
  if (!ops || !id) return { error: "Ungültige Anfrage." };

  try {
    await ops.setArchived(id, archived);
    const label = await ops.label({ id });
    await audited({ actor, entity, entityId: id }, `${entity}.archive`, `${label}: ${archived ? "archiviert" : "aus dem Archiv geholt"}`);
    revalidateStammdaten();
    return { success: `${label} ${archived ? "archiviert." : "aus dem Archiv geholt."}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Aktion fehlgeschlagen." };
  }
}

export async function deleteEntityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await requireManager();
  if ("failure" in guard) return guard.failure;
  const actor = guard.actor;

  const entity = str(formData, "entity") as StammdatenEntity;
  const id = str(formData, "id");
  const ops = ENTITY_OPS[entity];
  if (!ops || !id) return { error: "Ungültige Anfrage." };

  try {
    const label = await ops.label({ id });
    await ops.remove(id);
    await audited({ actor, entity, entityId: id }, `${entity}.delete`, `${label} gelöscht`);
    revalidateStammdaten();
    return { success: `${label} gelöscht.` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Dieser Eintrag wird verwendet und kann nicht gelöscht werden. Bitte archivieren." };
    }
    return { error: error instanceof Error ? error.message : "Löschen fehlgeschlagen." };
  }
}
