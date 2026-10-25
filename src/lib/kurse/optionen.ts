import "server-only";

// Auswahllisten für Kurs-/Anmeldeformulare (Modul 4/5): Sprachen, Niveaus,
// Kursarten, Dauern, Lehrpersonen (mit Qualifikations-Hinweis), Räume
// gruppiert nach Standort/Etage, Kostenträger.

import { db, fromDbTime } from "@/lib/db";

export interface SprachOption { id: string; name: string; code: string }
export interface NiveauOption { id: string; code: string; name: string | null }
export interface KursartOption { id: string; name: string; maxParticipants: number | null; requiresRoom: boolean }
export interface LehrpersonOption { id: string; name: string; kuerzel: string | null; qualifikationen: string }
export interface RaumOption {
  id: string;
  name: string;
  standortId: string;
  standortName: string;
  etageName: string;
  seats: number;
}
export interface KostentraegerOption { id: string; label: string }

export interface KursOptionen {
  sprachen: SprachOption[];
  niveaus: NiveauOption[];
  kursarten: KursartOption[];
  dauern: number[];
  lehrpersonen: LehrpersonOption[];
  raeume: RaumOption[];
  standorte: { id: string; name: string }[];
  kostentraeger: KostentraegerOption[];
}

export async function loadKursOptionen(): Promise<KursOptionen> {
  const [sprachen, niveaus, kursarten, dauern, lehrpersonen, raeume, etagen, standorte, qualifikationen, alleSprachen, alleNiveaus, kostentraeger] =
    await Promise.all([
      db.orm.public.Sprache.where({ active: true }).orderBy((s) => s.name.asc()).all(),
      db.orm.public.Niveau.where({ active: true }).orderBy([(n) => n.sortOrder.asc(), (n) => n.code.asc()]).all(),
      db.orm.public.Kursart.where({ active: true }).orderBy((k) => k.sortOrder.asc()).all(),
      db.orm.public.Lektionsdauer.where({ active: true }).orderBy((d) => d.minuten.asc()).all(),
      db.orm.public.Person.where({ istLehrperson: true }).orderBy([(p) => p.nachname.asc(), (p) => p.vorname.asc()]).all(),
      db.orm.public.Raum.where({ active: true }).all(),
      db.orm.public.Etage.all(),
      db.orm.public.Standort.where({ active: true }).orderBy((s) => s.name.asc()).all(),
      db.orm.public.Lehrqualifikation.all(),
      db.orm.public.Sprache.all(),
      db.orm.public.Niveau.all(),
      db.orm.public.Kostentraeger.where({ active: true }).orderBy((k) => k.name.asc()).all(),
    ]);

  const etageById = new Map(etagen.map((e) => [e.id, e]));
  const standortById = new Map(standorte.map((s) => [s.id, s]));

  const raumOptionen: RaumOption[] = raeume
    .map((r) => {
      const etage = etageById.get(r.etageId);
      const standort = etage ? standortById.get(etage.standortId) : undefined;
      return {
        id: r.id,
        name: r.name,
        standortId: standort?.id ?? "",
        standortName: standort?.name ?? "—",
        etageName: etage?.name ?? "—",
        seats: r.seats,
      };
    })
    .filter((r) => r.standortId !== "")
    .sort((a, b) => a.standortName.localeCompare(b.standortName) || a.name.localeCompare(b.name));

  const spracheById = new Map(alleSprachen.map((s) => [s.id, s]));
  const niveauById = new Map(alleNiveaus.map((n) => [n.id, n]));
  const qualByPerson = new Map<string, string[]>();
  for (const q of qualifikationen) {
    const s = spracheById.get(q.spracheId);
    const n = niveauById.get(q.niveauId);
    if (!s || !n) continue;
    const liste = qualByPerson.get(q.personId) ?? [];
    liste.push(`${s.name} ${n.code}`);
    qualByPerson.set(q.personId, liste);
  }

  return {
    sprachen: sprachen.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    niveaus: niveaus.map((n) => ({ id: n.id, code: n.code, name: n.name })),
    kursarten: kursarten.map((k) => ({
      id: k.id,
      name: k.name,
      maxParticipants: k.maxParticipants,
      requiresRoom: k.requiresRoom,
    })),
    dauern: dauern.map((d) => d.minuten),
    lehrpersonen: lehrpersonen.map((p) => ({
      id: p.id,
      name: `${p.nachname} ${p.vorname}`,
      kuerzel: p.kuerzel,
      qualifikationen: (qualByPerson.get(p.id) ?? []).slice(0, 4).join(", "),
    })),
    raeume: raumOptionen,
    standorte: standorte.map((s) => ({ id: s.id, name: s.name })),
    kostentraeger: kostentraeger.map((k) => ({ id: k.id, label: `${k.name} (${k.kundennummer})` })),
  };
}

/** Formatiert ein DB-DateTime als de-CH-Zeitstempel (für Listen). */
export function dbZeitLabel(s: string): string {
  return fromDbTime(s).toLocaleString("de-CH");
}
