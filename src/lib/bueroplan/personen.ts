import "server-only";

// Büro-Personen (Modul 8): Dienst- & Urlaubsplanung gilt nur für Konten mit
// BUERO-Rolle (plus Admin/Chef) — reine Lehrpersonen organisieren sich selbst.
// Eine Person ohne verknüpftes Konto kann keinen Dienst führen.

import { db, roleList, type Role } from "@/lib/db";

/** Rollen, die eine Person zur Büroperson machen (Pflichtenheft Modul 8). */
const BUERO_PLAN_ROLLEN: readonly Role[] = ["ADMIN", "CHEF", "BUERO"];

/** Hat das verknüpfte Konto dieser Person eine Büro-relevante Rolle? */
export async function istBueroperson(personId: string): Promise<boolean> {
  const user = await db.orm.public.User.where({ personId }).first();
  if (!user || !user.isActive) return false;
  return roleList(user.roles).some((r) => BUERO_PLAN_ROLLEN.includes(r));
}

/** Eine Büroperson für Listen und Formulare. */
export interface BueropersonOption {
  personId: string;
  name: string;
  rollen: Role[];
  kontoEmail: string;
}

/**
 * Alle Personen, die laut Konto (BUERO/ADMIN/CHEF) in der Dienstplanung
 * erscheinen — nach Nachname sortiert.
 */
export async function ladeBueropersonen(): Promise<BueropersonOption[]> {
  // User-Tabelle ist klein (Schule): alle laden und im JS filtern — Rollen-
  // Listen (Role[]) ohne Contains-Query zuverlässig auswerten.
  const users = await db.orm.public.User.all();
  const treffer = new Map<string, { rollen: Role[]; email: string }>();
  for (const u of users) {
    if (!u.isActive || !u.personId) continue;
    const rollen = roleList(u.roles);
    const relevant = rollen.filter((r) => BUERO_PLAN_ROLLEN.includes(r));
    if (relevant.length === 0) continue;
    const bestehend = treffer.get(u.personId);
    if (bestehend) {
      bestehend.rollen = [...new Set([...bestehend.rollen, ...relevant])];
    } else {
      treffer.set(u.personId, { rollen: relevant, email: u.email });
    }
  }
  const personIds = [...treffer.keys()];
  if (personIds.length === 0) return [];

  const personen = await db.orm.public.Person.where((p) => p.id.in(personIds)).all();
  return personen
    .map((p) => ({
      personId: p.id,
      name: `${p.vorname} ${p.nachname}`,
      rollen: treffer.get(p.id)?.rollen ?? [],
      kontoEmail: treffer.get(p.id)?.email ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Eine einzelne Büroperson (null, wenn unbekannt oder ohne Büro-Konto). */
export async function ladeBueroperson(personId: string): Promise<BueropersonOption | null> {
  const alle = await ladeBueropersonen();
  return alle.find((p) => p.personId === personId) ?? null;
}
