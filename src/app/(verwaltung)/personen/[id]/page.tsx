import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, fromDbTime, type Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManagePersonen, canViewPersonen } from "@/lib/auth/permissions";
import { ANREDE_LABELS, BILLING_TYP_LABELS } from "@/lib/domain";
import { guthabenStand, verbrauchtImPaket } from "@/lib/anmeldungen/paket";
import { KuerzelBadge, PersonStatusBadge } from "@/components/personen/PersonBadges";
import { KursStatusBadge } from "@/components/kurse/KursAktionen";
import { AnmeldungStatusBadge } from "@/components/anmeldungen/AnmeldungBadges";
import { PersonForm } from "@/components/personen/PersonForm";
import { PersonNotizen } from "@/components/personen/PersonNotizen";
import { PersonFamilie } from "@/components/personen/PersonFamilie";
import { PersonQualifikationen } from "@/components/personen/PersonQualifikationen";
import { PersonDeletePanel } from "@/components/personen/PersonDeletePanel";

export const metadata: Metadata = {
  title: "Person",
};

/** Person-Detail (Modul 3): Stammdaten, Notizen, Familie, Qualifikationen. */
export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <PersonDetailContent params={params} />
    </Suspense>
  );
}

async function PersonDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: actor } = await requireStaff();
  const roles = actor.roles as Role[];
  if (!canViewPersonen(roles)) {
    redirect("/dashboard");
  }
  const canManage = canManagePersonen(roles);

  const person = await db.orm.public.Person.where({ id }).include("user").first();
  if (!person) {
    notFound();
  }

  // Bezugsdaten: Notizen, Familien-Verknüpfungen, Qualifikationen sowie die
  // Stammlisten für Auswahlfelder/Labels (Mapping serverseitig per ID).
  const [notizen, elternLinks, kinderLinks, qualifikationen, sprachen, niveaus, allePersonen, honorarSaetze, honorarAbrechnungen] =
    await Promise.all([
      db.orm.public.PersonNotiz.where({ personId: id }).orderBy((n) => n.createdAt.desc()).all(),
      db.orm.public.PersonBeziehung.where({ kindId: id }).all(),
      db.orm.public.PersonBeziehung.where({ berechtigterId: id }).all(),
      db.orm.public.Lehrqualifikation.where({ personId: id }).all(),
      db.orm.public.Sprache.where({ active: true }).orderBy((s) => s.name.asc()).all(),
      db.orm.public.Niveau
        .where({ active: true })
        .orderBy([(n) => n.sortOrder.asc(), (n) => n.code.asc()])
        .all(),
      db.orm.public.Person
        .orderBy([(p) => p.nachname.asc(), (p) => p.vorname.asc()])
        .select("id", "vorname", "nachname", "email")
        .all(),
      db.orm.public.HonorarSatz.where({ lehrpersonId: id }).all(),
      db.orm.public.HonorarAbrechnung.where({ lehrpersonId: id }).all(),
    ]);

  const personById = new Map(allePersonen.map((p) => [p.id, p]));
  const optionOf = (pid: string) => {
    const p = personById.get(pid);
    if (!p) return null;
    return {
      id: p.id,
      label: p.email ? `${p.nachname} ${p.vorname} (${p.email})` : `${p.nachname} ${p.vorname}`,
    };
  };

  const spracheById = new Map(sprachen.map((s) => [s.id, s]));
  const niveauById = new Map(niveaus.map((n) => [n.id, n]));

  const eltern = elternLinks
    .map((link) => {
      const option = optionOf(link.berechtigterId);
      return option
        ? { beziehungId: link.id, personId: option.id, label: option.label }
        : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));

  const kinder = kinderLinks
    .map((link) => {
      const option = optionOf(link.kindId);
      return option
        ? { beziehungId: link.id, personId: option.id, label: option.label }
        : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));

  const candidates = allePersonen
    .filter((p) => p.id !== id)
    .map((p) => optionOf(p.id))
    .filter((o): o is NonNullable<typeof o> => o !== null);

  const quals = qualifikationen
    .map((q) => ({
      id: q.id,
      label: `${spracheById.get(q.spracheId)?.name ?? "?"} — ${niveauById.get(q.niveauId)?.code ?? "?"}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de-CH"));

  const deletable =
    !person.user &&
    elternLinks.length === 0 &&
    kinderLinks.length === 0 &&
    qualifikationen.length === 0 &&
    honorarSaetze.length === 0 &&
    honorarAbrechnungen.length === 0;
  const blockHint = person.user
    ? "Verknüpftes Konto: zuerst die Verknüpfung in der Benutzerverwaltung lösen."
    : elternLinks.length + kinderLinks.length > 0
      ? "Familien-Verknüpfungen bestehen — zuerst lösen."
      : qualifikationen.length > 0
        ? "Qualifikationen bestehen — zuerst entfernen."
        : honorarSaetze.length + honorarAbrechnungen.length > 0
          ? "Honorar-Daten (Sätze/Monats-Abrechnungen) bleiben historisch erhalten — Status «inaktiv» setzen."
          : null;

  // Kurs-Historie (Modul 4/5): alle Anmeldungen der Person, neueste zuerst.
  const historieAnmeldungen = await db.orm.public.Anmeldung
    .where({ personId: id })
    .orderBy((a) => a.createdAt.desc())
    .include("kurs")
    .include("kostentraeger")
    .all();
  const historieJournal = historieAnmeldungen.length
    ? await db.orm.public.GuthabenJournal
        .where((j) => j.anmeldungId.in(historieAnmeldungen.map((a) => a.id)))
        .all()
    : [];
  const historiePaket = new Map(
    historieAnmeldungen.map((a) => {
      const eintraege = historieJournal
        .filter((j) => j.anmeldungId === a.id)
        .map((j) => ({ art: j.art, delta: j.delta, datum: String(j.datum) }));
      return [
        a.id,
        {
          verbraucht: verbrauchtImPaket(eintraege, String(a.paketStartAt)),
          guthaben: guthabenStand(eintraege),
        },
      ];
    }),
  );

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/personen" className="text-sm text-slate-600 hover:text-brand-700">
          ← Personen-Kartei
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">
            {person.vorname} {person.nachname}
          </h1>
          <PersonStatusBadge status={person.status} />
          {person.istLehrperson && <span className="text-xs text-emerald-700">Lehrperson</span>}
          {person.istLehrperson && person.kuerzel && <KuerzelBadge kuerzel={person.kuerzel} />}
        </div>
        <p className="mt-0.5 text-sm text-slate-600">
          {ANREDE_LABELS[person.anrede]}
          {person.email ? ` · ${person.email}` : ""}
          {person.plz || person.ort ? ` · ${[person.plz, person.ort].filter(Boolean).join(" ")}` : ""}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Stammdaten & Kontakt</h2>
        <PersonForm
          person={{
            id: person.id,
            status: person.status,
            anrede: person.anrede,
            vorname: person.vorname,
            nachname: person.nachname,
            email: person.email,
            strasse: person.strasse,
            plz: person.plz,
            ort: person.ort,
            rechnungStrasse: person.rechnungStrasse,
            rechnungPlz: person.rechnungPlz,
            rechnungOrt: person.rechnungOrt,
            telefon1: person.telefon1,
            whatsapp1: person.whatsapp1,
            signal1: person.signal1,
            telefon2: person.telefon2,
            whatsapp2: person.whatsapp2,
            signal2: person.signal2,
            istLehrperson: person.istLehrperson,
            kuerzel: person.kuerzel,
            hasLinkedUser: Boolean(person.user),
          }}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">CRM-Notizen</h2>
          <PersonNotizen
            personId={person.id}
            canManage={canManage}
            notizen={notizen.map((n) => ({
              id: n.id,
              text: n.text,
              authorName: n.authorName,
              createdAt: fromDbTime(n.createdAt).toLocaleString("de-CH", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            }))}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Familie & Erziehungsberechtigte
          </h2>
          <PersonFamilie
            personId={person.id}
            eltern={eltern}
            kinder={kinder}
            candidates={candidates}
            canManage={canManage}
          />
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Qualifikationen</h2>
          <PersonQualifikationen
            personId={person.id}
            istLehrperson={person.istLehrperson}
            qualifikationen={quals}
            sprachen={sprachen.map((s) => ({ id: s.id, label: s.name }))}
            niveaus={niveaus.map((n) => ({ id: n.id, label: n.name ? `${n.code} · ${n.name}` : n.code }))}
            canManage={canManage}
          />
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Konto (Login)</h2>
            {person.user ? (
              <p className="text-sm text-slate-700">
                Verknüpft mit{" "}
                <Link href={`/benutzer/${person.user.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                  {person.user.email}
                </Link>{" "}
                — die E-Mail bleibt automatisch synchron.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Noch kein Konto verknüpft. Konten legt das Büro unter{" "}
                <Link href="/benutzer" className="font-medium text-brand-700 hover:text-brand-800">
                  Benutzer
                </Link>{" "}
                an — dort lässt sich ein Konto direkt mit dieser Person verknüpfen.
              </p>
            )}
          </section>

          {canManage && (
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Person löschen</h2>
              <PersonDeletePanel
                personId={person.id}
                personLabel={`${person.vorname} ${person.nachname}`}
                deletable={deletable}
                blockHint={blockHint}
              />
            </section>
          )}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">Kurs-Historie</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Alle Kurse parallel und hintereinander, auch mehrsprachig — neueste zuerst.
        </p>
        {historieAnmeldungen.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Kurs</th>
                  <th className="th">Anmeldung</th>
                  <th className="th">Kursstatus</th>
                  <th className="th">Billing</th>
                  <th className="th">Paket</th>
                  <th className="th">Guthaben</th>
                  <th className="th">Seit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {historieAnmeldungen.map((a) => {
                  const paket = historiePaket.get(a.id) ?? { verbraucht: 0, guthaben: 0 };
                  return (
                    <tr key={a.id} className={a.status === "BEENDET" ? "text-slate-500" : ""}>
                      <td className="td font-mono text-xs font-semibold">
                        <Link href={`/kurse/${a.kursId}`} className="hover:text-brand-700">
                          {a.kurs.code}
                        </Link>
                      </td>
                      <td className="td">
                        <Link href={`/anmeldungen/${a.id}`} className="hover:text-brand-700">
                          <AnmeldungStatusBadge status={a.status} />
                        </Link>
                      </td>
                      <td className="td">
                        <KursStatusBadge status={a.kurs.status} />
                      </td>
                      <td className="td text-xs">
                        {BILLING_TYP_LABELS[a.billingTyp]}
                        {a.kostentraeger ? <span className="block text-slate-500">{a.kostentraeger.name}</span> : null}
                      </td>
                      <td className="td whitespace-nowrap">
                        {paket.verbraucht}/{a.paketGroesse}
                      </td>
                      <td className="td">{paket.guthaben}</td>
                      <td className="td whitespace-nowrap text-xs text-slate-500">
                        {fromDbTime(a.createdAt).toLocaleDateString("de-CH")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Noch keine Kurse — die Person ist nicht angemeldet.</p>
        )}
      </section>
    </div>
  );
}
