import "server-only";

// Datenschicht des KI-Lektionsgenerators (Modul 14): Auswahllisten,
// Bibliothek (eigene + geteilte Lektionen) und Detail-Zugriff. Die
// Zugriffsregel ist an einer Stelle gebündelt: eigene Lektionen, geteilte
// Lektionen und Admin/Chef.

import { db } from "@/lib/db";
import type { KiLektionMitRelationen } from "@/lib/domain";

export interface KiOptionen {
  sprachen: { id: string; name: string }[];
  niveaus: { id: string; code: string; name: string | null }[];
  kursarten: { id: string; name: string }[];
}

/** Aktive Stammdaten für die Auswahl im Generator. */
export async function ladeKiOptionen(): Promise<KiOptionen> {
  const [sprachen, niveaus, kursarten] = await Promise.all([
    db.orm.public.Sprache.where((s) => s.active.eq(true)).orderBy((s) => s.name.asc()).all(),
    db.orm.public.Niveau.where((n) => n.active.eq(true)).orderBy((n) => n.sortOrder.asc()).all(),
    db.orm.public.Kursart.where((k) => k.active.eq(true)).orderBy((k) => k.sortOrder.asc()).all(),
  ]);

  return {
    sprachen: sprachen.map((s) => ({ id: s.id, name: s.name })),
    niveaus: niveaus.map((n) => ({ id: n.id, code: n.code, name: n.name ?? null })),
    kursarten: kursarten.map((k) => ({ id: k.id, name: k.name })),
  };
}

/** Robuster Zeitstempel-Vergleich (DateTime kommt als String aus der DB). */
function zeitwert(wert: unknown): number {
  if (wert instanceof Date) return wert.getTime();
  const s = String(wert ?? "");
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const zeit = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  return Number.isNaN(zeit) ? 0 : zeit;
}

export interface KiBibliothekFilter {
  suche?: string;
}

/**
 * Bibliothek: eigene Lektionen und ausdrücklich geteilte Lektionen aller
 * Personen. Zwei Queries + Zusammenführung in JS — vermeidet fragile
 * OR-Filter und hält die Limits klein.
 */
export async function ladeKiLektionen(
  userId: string,
  filter: KiBibliothekFilter = {},
): Promise<KiLektionMitRelationen[]> {
  const [eigene, geteilte] = await Promise.all([
    db.orm.public.KiLektion
      .where((l) => l.erstelltVonUserId.eq(userId))
      .include("sprache")
      .include("niveau")
      .include("kursart")
      .orderBy((l) => l.createdAt.desc())
      .limit(60)
      .all(),
    db.orm.public.KiLektion
      .where((l) => l.geteilt.eq(true))
      .include("sprache")
      .include("niveau")
      .include("kursart")
      .orderBy((l) => l.createdAt.desc())
      .limit(60)
      .all(),
  ]);

  const gesehen = new Map<string, KiLektionMitRelationen>();
  for (const row of [...eigene, ...geteilte]) gesehen.set(row.id, row);

  let rows = [...gesehen.values()].sort((a, b) => zeitwert(b.createdAt) - zeitwert(a.createdAt));

  const suche = filter.suche?.trim().toLowerCase();
  if (suche) {
    rows = rows.filter((r) =>
      [r.titel, r.thema, r.erstelltVonName, r.modell]
        .some((wert) => (wert ?? "").toLowerCase().includes(suche)),
    );
  }
  return rows.slice(0, 100);
}

/**
 * Einzelne Lektion laden — nur mit Zugriff: eigene, geteilte oder Admin/Chef.
 * Gibt `null` zurück, wenn sie nicht existiert ODER kein Zugriff besteht
 * (die Seiten zeigen dann einen 404-Zustand, ohne Existenz zu verraten).
 */
export async function ladeKiLektion(
  id: string,
  userId: string,
  zugriffAdmin: boolean,
): Promise<KiLektionMitRelationen | null> {
  const row = await db.orm.public.KiLektion.where({ id })
    .include("sprache")
    .include("niveau")
    .include("kursart")
    .first();
  if (!row) return null;
  const zugriff = row.erstelltVonUserId === userId || row.geteilt || zugriffAdmin;
  return zugriff ? row : null;
}

/** Anzahl sichtbarer Lektionen (für die Stammdaten-/Dashboard-Karte). */
export async function zaehleKiLektionen(userId: string): Promise<number> {
  const [eigene, geteilte] = await Promise.all([
    db.orm.public.KiLektion.where((l) => l.erstelltVonUserId.eq(userId)).aggregate((a) => ({ n: a.count() })),
    db.orm.public.KiLektion.where((l) => l.geteilt.eq(true)).aggregate((a) => ({ n: a.count() })),
  ]);
  return Math.max(eigene.n, geteilte.n);
}
