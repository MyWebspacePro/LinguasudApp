import "server-only";

// Auswahllisten für das Anmeldeformular (Modul 5).

import { db } from "@/lib/db";
import type { AnmeldungOptionen } from "@/components/anmeldungen/AnmeldungForm";

export async function loadAnmeldungOptionen(): Promise<
  AnmeldungOptionen & { kursStartZeit: Map<string, string | null> }
> {
  const [kurse, personen, tarifstufen, kostentraeger] = await Promise.all([
    db.orm.public.Kurs
      .where((k) => k.status.in(["GEPLANT", "AKTIV", "PAUSIERT"]))
      .orderBy((k) => k.code.asc())
      .include("sprache")
      .include("niveau")
      .include("kursart")
      .all(),
    db.orm.public.Person
      .where((p) => p.status.in(["INTERESSENT", "AKTIV"]))
      .orderBy([(p) => p.nachname.asc(), (p) => p.vorname.asc()])
      .all(),
    db.orm.public.Tarifstufe.where({ active: true }).all(),
    db.orm.public.Kostentraeger.where({ active: true }).orderBy((k) => k.name.asc()).all(),
  ]);

  const tarifOptionen = tarifstufen.map((t) => ({
    id: t.id,
    name: t.name,
    lessonsPerPackage: t.lessonsPerPackage,
    hinweis: tarifHinweis(t.name, t.middayFrom, t.middayTo, t.eveningFrom),
  }));

  return {
    kurse: kurse.map((k) => ({
      id: k.id,
      code: k.code,
      beschreibung: `${k.sprache.name} ${k.niveau.code} · ${k.kursart.name}${k.extern ? " · extern" : ""}`,
      startZeit: k.startZeit,
    })),
    personen: personen.map((p) => ({
      id: p.id,
      label: `${p.nachname} ${p.vorname}${p.email ? ` (${p.email})` : ""}`,
    })),
    tarifstufen: tarifOptionen,
    kostentraeger: kostentraeger.map((k) => ({ id: k.id, label: `${k.name} (${k.kundennummer})` })),
    kursStartZeit: new Map(kurse.map((k) => [k.id, k.startZeit])),
  };
}

function tarifHinweis(name: string, middayFrom: string | null, middayTo: string | null, eveningFrom: string | null): string {
  const hoch = middayFrom && middayTo ? `${middayFrom}–${middayTo}` : null;
  const teile = [hoch ? `über Mittag ${hoch}` : null, eveningFrom ? `ab ${eveningFrom}` : null].filter(Boolean);
  return teile.length > 0 ? `${name}: ${teile.join(" · ")}` : `${name}: Vormittag/Nachmittag`;
}
