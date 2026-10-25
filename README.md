# LinguasudApp

Verwaltungssoftware für die **Sprachschule linguasud.com** — Kurse, Lehrkräfte,
Büro, Kursteilnehmende, Raumplanung, Anwesenheit, Rechnungen (QR),
Kursbestätigungen, Honorare, Vermietung und öffentliche Website.

Die vollständigen Anforderungen stehen im **[PFLICHTENHEFT.md](./PFLICHTENHEFT.md)**.

## Modul 11 — Honorarabrechnung (fertig)

- **Nur durchgeführte Lektionen zählen** (Status `DURCHGEFUEHRT` aus der
  Anwesenheitskontrolle, Modul 7); Absenzen von Teilnehmenden zählen normal
  (die Lektion fand statt). Massgebend ist `Lektion.lehrpersonId` — der
  Snapshot der Lehrperson zum Termin, unabhängig von späteren Kurswechseln.
- **Honorar-Matrix:** Lehrperson × Kursart × Lektionsdauer mit **globalem
  Default-Stundensatz** (`SystemSetting` «honorar.defaultStundensatz», pflegt
  nur Admin im Stammdaten-Bereich `/honorare/saetze`) als Vorbelegung — fallen
  alle denselben Stundensatz, genügt ein Wert. Abweichungen pro Lehrperson
  setzt das Büro (Admin/Chef/Büro) auf derselben Seite; die Lektionsdauer wird
  hochgerechnet (Stundensatz × Minuten/60, auf 5 Rappen gerundet). Lektionen
  ohne anwendbaren Satz werden rot markiert und blockieren das Markieren
  (kein falsches 0.00).
- **Monats-Workflow** (`/honorare`, Büro-Operativ wie Anmeldungen): Monat
  wählen (Navigation ‹/›) → Lektionsliste je Lehrperson (Datum, Kurs, Dauer,
  angewandter Satz mit Quelle Default/Abweichung, Betrag) → Total →
  **«Als bezahlt markieren»** friert Snapshot (Lektionszahl, Total) ein;
  ändert sich die Liste danach (z.B. Anwesenheit nachträglich abgeschlossen),
  warnt ein Banner. «Wieder öffnen» setzt den Status zurück. Lektionen ohne
  Lehrperson werden als nicht abrechenbar gemeldet. Alles im Audit-Log
  (`honorar.*`).
- **PDF-Beleg pro Lehrperson und Monat** (`/honorare/[lehrpersonId]/[monat]/pdf`,
  Rechte-Check in der Route): Datum, Kurs, Dauer, Satz, Betrag je Lektion +
  Total — nach dem Muster der Kursbestätigungen (A4, Helvetica, Briefkopf mit
  Logo-Platzhalter aus `public/`).
- **Finanz-Dashboard des Chefs:** Karte «Honorare <Monat>» auf `/dashboard`
  (Admin/Chef) mit offenen/bezahlten Monats-Totals und Link in die Abrechnung.
- Logik in `src/lib/honorare/` (`logik.ts` pure + getestet — Satz-Auflösung,
  5-Rappen-Rundung, Monats-Gruppierung; `abrechnung.ts` Datenladen,
  `actions.ts` Server-Actions, `pdf.ts`/`druck.ts` Beleg-PDF); UI in
  `src/app/(verwaltung)/honorare/` + `src/components/honorare/HonorarFormen.tsx`.

### Test-Daten Modul 11 (lokal, Präfix `m11_`)

- Lehrperson **Heidi Held** (`m11_lehr_heidi`, Kürzel HHEI) unterrichtet die
  7 durchgeführten Lektionen des Testkurses `DEU-B1-6ER-TEST01-01` (Aug–Nov
  2026, 60 Min): Default-Stundensatz CHF 40.00/h, Abweichung 6er/60 Min =
  CHF 45.00/h und Einzel/90 Min = CHF 50.00/h. August 2026 ist als bezahlt
  markiert (CHF 135.00, 3 Lektionen), Sep–Nov offen.

## Technologie-Stack

| Baustein | Wahl | Bemerkung |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, TypeScript) | Fullstack: Verwaltung + öffentliche Website in einer App |
| Styling | **Tailwind CSS 4** | Hell/freundlich, Bordeaux (`--color-brand-*`) als Akzentfarbe, kompakte Dichte |
| Datenbank | **PostgreSQL 17** | Lokal via Docker, im VPS als Coolify-Container |
| ORM | **Prisma 8** (`8.0.0-rc.27` + `@prisma/orm-postgres`, exakt gepinnt) | Contract-basiertes ORM: `prisma/schema.prisma` ist die Contract-Quelle; Queries über `db.orm.public.<Modell>`, DateTime-Felder als UTC-Strings (Konvertierung in `src/lib/domain.ts`) |
| Tests | **Vitest** | |
| Versand | **Docker** (node:22-alpine, Standalone-Build) | Deployment über Coolify auf den VPS |

## Lokale Entwicklung

Voraussetzungen: Node 22, pnpm, Docker Desktop (für die Datenbank).

```bash
pnpm install          # Abhängigkeiten
pnpm db:up            # PostgreSQL als Container starten
cp .env.example .env  # falls noch nicht vorhanden (lokal vorkonfiguriert)
pnpm db:generate      # Contract aus dem Schema kompilieren (nach jeder Schema-Änderung)
pnpm dev              # http://localhost:3000
```

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `pnpm build` | Produktions-Build (**nicht bei laufendem `pnpm dev`** — er korrumpiert den Dev-Cache unter `.next`; vorher stoppen, danach Dev neu starten) |
| `pnpm test` / `pnpm test:watch` | Tests (Vitest) |
| `pnpm typecheck` | TypeScript-Prüfung |
| `pnpm lint` | ESLint |
| `pnpm db:plan` | Migration aus dem Contract planen (z.B. `pnpm db:plan --name mein_change`) |
| `pnpm db:migrate` | Geplante Migrationen lokal anwenden (`db migrate --advance-ref db`) |
| `pnpm db:status` | Migrations-Status der Datenbank |
| `pnpm db:verify` | Schema + Marker gegen den Contract prüfen |
| `pnpm db:down` | Datenbank-Container stoppen |

### Prisma-8-Workflow (Schema ändern)

1. `prisma/schema.prisma` anpassen.
2. `pnpm db:generate` — kompiliert `src/prisma/contract.json` + `contract.d.ts` (beide liegen in Git).
3. `pnpm db:plan --name <snake_case_name>` — schreibt ein Migrations-Paket nach `migrations/app/`. Bei Datenverlust-Fragen antwortet die CLI interaktiv (`--delete`/`--rename`).
4. `pnpm db:migrate` — wendet die Pakete an und rückt den `db`-Ref nach.
5. Falls nötig: `pnpm db:verify` (Diagnose bei Drift).

## Deployment (Coolify)

1. **GitHub:** Push auf `main` (Repo `MyWebspacePro/LinguasudApp`) — Coolify
   deployt automatisch (Webhook). Tests laufen lokal; jeder Push geht live.
2. **Coolify-Ressourcen:**
   - PostgreSQL-Container (Datenbank)
   - App aus dem Dockerfile des Repos, Domain `linguasudapp.aiconso.eu`
3. **Umgebungsvariablen in Coolify** (siehe `.env.example`):
   `DATABASE_URL`, `APP_ENV=production`, `APP_URL`, später `SMTP_*` (IONOS) und
   QR-Rechnungs-/OpenRouter-Schlüssel.
4. Beim Containerstart prüft der Entrypoint das Schema gegen den Contract
   (`prisma db sign`, adoptiert bestehende Datenbanken) und wendet dann
   ausstehende Migrationen an (`prisma db migrate`); danach startet der Server.
   Healthcheck: `/api/health`.
5. **Backups:** Coolify-Datenbank-Backup täglich, ca. 14 Tage Aufbewahrung.

## Projektstruktur

```
prisma/            Datenbankschema (Contract-Quelle) + alte Prisma-6/7-SQL-Migrationen (Historie, inert)
migrations/        Prisma-8-Migrationspakete (migrations/app/) + Snapshot-Store
src/prisma/        Generierter Contract + DB-Client (prisma contract emit)
src/app/           Seiten (Verwaltung, Portal, öffentliche Website) + API-Routen
src/lib/           geteilte Bibliothek (DB-Client, pures Domain-Modul, Env-Validierung, Domänenlogik)
src/lib/auth/      Login & Rechte (Modul 1): Sessions, Passwort-Politik, Brute-Force, Rollen
src/components/    UI-Bausteine (Bordeaux-Design-System, siehe globals.css)
src/proxy.ts       Optimistische Zugangslenkung (Next.js 16 Proxy, früher Middleware)
src/instrumentation.ts  Server-Start-Hook (legt das erste Admin-Konto an, falls DB leer)
docker-entrypoint.sh  Schema-Adoption + Migrationen + Serverstart im Container
PFLICHTENHEFT.md   Anforderungen (verbindlich für die Umsetzung)
```

## Modul 10 — Kursbestätigungen (PDF) (fertig)

- **Auslöser: Niveau-Wechsel.** Schliesst ein Niveau-Wechsel (Modul 4 — ob von der
  Lehrperson gemeldet oder vom Büro gesetzt) einen Verlauf-Abschnitt ab, erzeugt das
  System **automatisch** die Kursbestätigung für **alle aktiven Teilnehmenden** des
  abgeschlossenen Abschnitts und stellt sie im **Teilnehmenden-Portal zum Selbstdrucken**
  bereit (Erfolgsmeldung am Niveau-Wechsel nennt Anzahl und Niveau). Schlägt die
  Automatik ausnahmsweise fehl, bleibt der Wechsel gültig — das Büro kann manuell erzeugen.
- **Inhalt (nur Deutsch, keine Leistungsbewertung):** Briefkopf mit **Logo** (Platzhalter
  `public/logo-linguasud.png`, Bordeaux-«L» — später 1:1 durch das echte Logo ersetzbar,
  alternativ `logo-linguasud.jpg`; fehlt die Datei, druckt das PDF ohne Logo) und
  Schuladresse (aus den `QR_RECHNUNG_*`-Variablen), Anrede + Name (Briefanrede nach
  Anrede: «Sehr geehrte Frau …» / «Sehr geehrter Herr …» / «Guten Tag …»), **Sprache +
  bestätigtes Niveau**, **Kursart**, Kurs-Nr., **Zeitraum** des Abschnitts, **besuchte
  Lektionen**, Ausstellungsdatum (Ort, Datum) und **Unterschriftszeile**.
- **Besuchte Lektionen** = Anwesenheit **ANWESEND** der Person in **DURCHGEFUEHRTen**
  Lektionen des Kurses, deren Lokaltag (Europe/Zurich, DST-sicher über `src/lib/zeit.ts`)
  im Abschnitts-Zeitraum liegt (Grenzen inklusive).
- **Snapshots:** Name/Anrede, Sprache, Niveau, Kursart, Kurscode, Zeitraum, Lektionszahl
  und Ausstellungsdatum werden bei der Erzeugung eingefroren (`Kursbestaetigung`-Modell,
  Unique pro Person × Niveau-Abschnitt) — spätere Stammdaten-Änderungen ändern alte
  Bestätigungen nicht.
- **Büro kann jederzeit manuell erzeugen** (Button je Abschnitt im Niveau-Verlauf der
  Kurs-Detailseite, `canManageKurse`): schliesst **beendete Anmeldungen** ein (z.B.
  Ausstieg mitten im Niveau) und funktioniert auch für den **laufenden Abschnitt**
  (Zeitraum dann bis heute, Button heisst «(laufend)»). Erneutes Erzeugen aktualisiert
  die Snapshots (z.B. nach Anwesenheits-Korrekturen); einzelne Bestätigungen lassen sich
  löschen. Alles im Audit-Log (`bestaetigung.*`).
- **Portal** (`/portal`): Liste der eigenen Bestätigungen (Niveau, Zeitraum, Lektionen,
  Kurs) mit **PDF-Druck-Link** `/bestaetigungen/[id]/pdf` — Rechte-Check in der Route:
  Verwaltung (`canManageKurse`) oder **eigene Person** (fremde Bestätigungen → 404).
- Logik in `src/lib/bestaetigungen/` (`logik.ts` pure + getestet — Anrede/Zählung,
  `erstellung.ts` Kern inkl. Audit, `pdf.ts`/`druck.ts` PDF mit pdf-lib, `actions.ts`);
  UI: Spalte «Kursbestätigungen» im Niveau-Verlauf der Kurs-Detailseite
  (`src/components/kurse/BestaetigungAktionen.tsx`) + Portal-Karte.

### Test-Konten & Testdaten (lokal)

- Verwaltung: `buero@linguasud.test` / `admin@linguasud.test`, Passwort
  `Modul8TestPasswort2026!`.
- Modul-10-Testdaten (Präfix `m10_` in der DB): Testkurs `DE-A2-6ER-TEST01-01` mit
  Niveau-Verlauf A2→B1, 6 durchgeführten Lektionen (Aug–Okt, DST-gestreut) + 2 aktive
  (Tina: 6× anwesend, Max: 5×) und 1 beendete Anmeldung (Zea: 4×); daraus 3 Bestätigungen.
- Teilnehmer-Login für Portal-Tests: `tina.test@linguasud.test` /
  `Modul10TestPasswort2026!` (Konto `m10_user_tina`, Rolle TEILNEHMER, Person Tina Testerin).

## Modul 9 — Rechnungen (PDF) (fertig)

- **Schweizer QR-Rechnung:** jedes PDF trägt den normierten **QR-Zahlteil** (Empfangsschein +
  Zahlteil, QR-Code 46×46 mm mit Schweizer Kreuz, Perforationslinie). QR-IBAN-Prüfung
  (QR-IID 30000–31999, mod-97) und 27-stellige **Referenznummer** (mod-10-rekursiv) laufen über
  `src/lib/rechnungen/qr.ts` — getestet gegen die Referenzbeispiele des Swiss-QR-Bill-Guides.
  Die Payload wurde im Live-Test aus dem erzeugten PDF dekodiert und verifiziert.
- **Konfiguration:** `QR_RECHNUNG_QR_IBAN`, `QR_RECHNUNG_NAME/STRASSE/PLZ/ORT/LAND`
  (siehe `.env.example`; lokal Dummy-Werte, in Coolify die echten Bankdaten). Ohne
  Konfiguration bricht die PDF-Erzeugung mit klarer Meldung ab.
- **Mehrere Positionen** (Paket, Lehrmittel, Registration …) mit Menge × Einzelpreis, optionales
  **MwSt-Feld** (leer = MwSt-frei), Zwischensumme/Total; bei Teilzahlungen zeigt Rechnung und
  PDF **Restbetrag** bzw. «Bereits bezahlt».
- **Empfänger:** Person (mit **abweichender Rechnungsadresse** als Snapshot), Kostenträger
  (Firma/öffentliche Einrichtung) oder **Eltern als abweichender Empfänger** (über die
  Anmeldung, Modul 5). Empfänger-Adresse wird beim Erstellen eingefroren.
- **Status-Laufbahn:** Entwurf → versendet → (teilbezahlt) → bezahlt → storniert; **überfällig**
  ist abgeleitet (versendet/teilbezahlt + Fälligkeit verstrichen) und wird als rotes Badge
  angezeigt, nicht gespeichert.
- **Automatik:** bei **fester Anmeldung** und **Paket-Verlängerung** (privat/Firma — Anschluss
  an die Paketende-Automatik aus Modul 5/7) entsteht automatisch ein Rechnungs-Entwurf mit der
  Paketposition; Behörden (öffentliche Einrichtungen) rechnen im Nachhinein manuell durchs Büro.
- **Versenden** markiert als versendet und hängt das PDF an eine E-Mail an (ohne SMTP:
  Dev-Log). **Teilzahlungen** werden erfasst (Betrag ≤ Restbetrag geprüft) und setzen den
  Status automatisch auf teilbezahlt/bezahlt — alles im Audit-Log (`rechnung.*`).
- **Auto-Mahnung:** Mahn-Job (`src/lib/rechnungen/mahnjob.ts`, 30-Minuten-Schleife wie die
  übrigen Jobs) versendet **Stufe 1 = freundliche Erinnerung** 10 Tage nach Fälligkeit und
  **Stufe 2 = Mahnung** nach 30 Tagen — je genau einmal (`mahnStufe` als Marker), mit
  Mahnungs-Historie auf der Rechnung. Das Büro kann beide Stufen jederzeit manuell früher
  auslösen.
- Logik in `src/lib/rechnungen/` (`qr.ts` + `logik.ts` pure + getestet, `erstellung.ts`,
  `druck.ts` (PDF mit pdf-lib + qrcode), `mahnung.ts`, `mahnjob.ts`, `actions.ts`); UI unter
  `/rechnungen` (Liste, Detail, «Neue Rechnung») für Admin/Chef/Büro (`canManageAnmeldungen`).
  Rechte-Checks in den Actions + PDF-Route, Audit für jeden Schritt.

## Modul 8 — Dienst- & Urlaubsplanung Büro (fertig)

- **Eigene Ansicht `/bueroplan`** (bewusst nicht im Raumplaner): Wochenansicht Mo–So über alle
  **Büropersonen** — Personen mit Konto der Rolle **Büro, Admin oder Chef** (Verknüpfung über
  `User.personId`); reine Lehrpersonen organisieren sich selbst und erscheinen nicht. Wochen-Navigation
  (‹ / Diese Woche / ›), heutige Spalte hervorgehoben, Legende der Blöcke.
- **Wiederkehrendes Pensum pro Person** (`BueroDienst`): beliebig viele Zeitblöcke pro Wochentag
  (z.B. 45 Min vor + nach Unterricht, «2 Vormittage + 3 Nachmittage»), mehrere Personen parallel.
- **Tages-Abweichungen** (`BueroAbweichung`, ein Eintrag pro Person und Tag): **abweichende
  Arbeitszeit** ersetzt die Pensum-Blöcke des Tages, **dienstfrei** (z.B. Kompensation) zählt nicht
  aufs Urlaubs-Kontingent. In der Wochenansicht gelb bzw. als Badge.
- **Abwesenheiten** (`BueroAbwesenheit`): **Urlaub** (zählt aufs Kontingent), **Krankheit**,
  **sonstige** — als Kalenderbereich (von–bis inklusive), direkt eingetragen **ohne
  Genehmigungs-Workflow**; Abwesenheiten haben in der Anzeige Vorrang vor Abweichung und Pensum.
- **Urlaubs-Jahreskontingent** (`BueroUrlaubskontingent`, anpassbar): Standard **20 Tage** pro Person
  und Jahr; genutzt = Summe der Kalendertage der URLAUB-Einträge im Jahr (am Jahresrand anteilig).
  Überschreitung wird beim Erfassen als Warnhinweis gemeldet (keine harte Blockade), die
  Wochenansicht zeigt «genutzt / Kontingent» pro Person; alle im Stundenlohn.
- Alle Änderungen Server-seitig auf Büro-Rollen geprüft (`canManageBueroplan`, Wächter in den
  Actions + Ziel-Person-Prüfung) und vollständig im **Audit-Log** (`bueroplan.*`). Logik in
  `src/lib/bueroplan/` (`logik.ts` pure + getestet, `actions.ts`, `personen.ts`); Formulare in
  `src/components/bueroplan/BueroplanFormen.tsx`.

## Modul 7 — Anwesenheitskontrolle (fertig)

- **Erfassung direkt nach der Lektion** im Planer-Panel (Klick auf den Block): je Teilnehmende(r)
  **anwesend (−1) · abwesend unentschuldigt (−1) · abwesend entschuldigt (−0)** — **Probeteilnehmende
  erscheinen in der Liste, werden aber ohne Abbuchung erfasst**. Die **Lehrperson hat 24 h** nach dem
  Lektionsende, danach ist nur noch das Büro berechtigt (Server-seitig geprüft, nicht nur UI).
- **Abschliessen erst bei vollständiger Erfassung** (alle aktiven Anmeldungen erfasst): setzt die
  Lektion auf **DURCHGEFÜHRT** und bucht je aktiver Anmeldung ins **Guthaben-Journal**
  (VERBRAUCH/FEHLZEIT-artspezifisch, mit Lektions-Link `lektionId` für Korrekturen). Danach läuft
  die **Paketende-Automatik**: Schwelle (12. von 14 / 13. von 15) erreicht → Teilnehmende werden
  automatisch informiert («fortfahren oder beenden?», Marker `paketEndeGemeldetAt`).
- **Büro korrigiert nachträglich:** Anwesenheiten lassen sich nach dem Abschluss anpassen — der
  Journal-Eintrag wird angepasst (nicht doppelt gebucht), jeder Korrektur-Schritt steht im Audit-Log.
  Die manuelle Fehlzeit-Erfassung in der Anmeldung (Modul 5, `erfasseFehlzeitAction`) bleibt als
  Büro-Korrekturweg ohne Lektions-Link bestehen.
- **Lehrpersonen dürfen Lektionen selbst absagen** (Grund ist Pflicht): gleiche Aktion wie das Büro,
  Teilnehmende werden automatisch informiert, kein Guthaben-Abzug (Audit: `planer.absagen_lehrperson`).
- **Offene Anwesenheiten:** das Dashboard listet beendete, nicht abgeschlossene Lektionen (Büro: alle;
  reine Lehrpersonen: eigene) mit Erfassungsfortschritt x/y und Direktlink in den Planer-Tag.
- **Automatische Erinnerung am nächsten Tag:** nächtlicher Job (`src/lib/anwesenheit/erinnerungsjob.ts`,
  Marker-Pattern wie der Lektions-Job) mailt der Lehrperson die offenen Lektionen — pro Lektion nur
  einmal (`anwesenheitErinnertAt`).
- Logik in `src/lib/anwesenheit/` (`logik.ts` pure + getestet, `actions.ts` Server-Actions,
  `erinnerung.ts`/`erinnerungsjob.ts` Job); Lektionsstatus **DURCHGEFÜHRT** ist die Grundlage, damit
  Modul 11 (Honorare) nur abgeschlossene Lektionen zählt.

## Modul 6 — Lektionsgenerierung & Raumplaner (fertig)

- **Rollierende Generierung 2 Wochen im Voraus:** nächtlicher Job (`src/lib/kurse/lektionsjob.ts`,
  Prüfschleife alle 30 Minuten über einen Tages-Marker in `SystemSetting`) erzeugt für alle
  **aktiven** Kurse mit Wochentermin die Lektionen — idempotent, Unterbrechungen werden
  übersprungen. Zusätzlich Button «Lektionen generieren» im Planer (Büro).
- **Planer** (`/planer`): Tagansicht im 14-Tage-Horizont (Tag-Streifen Mo–Sa), Zeitraster
  **06:30–23:00**, Spalten oben **Standort → Etage → Räume**; Kurse ohne Raum (Online) in einer
  eigenen «Online»-Spalte, **externe Firmenkurse erscheinen nicht**. Blöcke zeigen das
  Lehrpersonen-Kürzel, **Details beim Hover** (Sprache, Niveau, Kursart, Lehrperson, Code, Zeit).
- **Verschieben nur durchs Büro:** Klick auf einen Block öffnet das Panel — Verschieben
  (Datum/Zeit/Raum, macht die Lektion wieder **provisorisch**), **Fixieren** (bindend; weicht der
  Termin vom Wochentermin ab oder wurde manuell verschoben, werden alle Teilnehmenden
  informiert) und **Absagen** (mit Grund, informiert ebenfalls; kein Guthaben-Abzug).
- **Keine harte Konfliktblockade:** Raum-Doppelbelegungen und Doppel-Einsätze derselben
  Lehrperson werden nur **rot markiert**; pausierte/unterbrochene Kurse sind ausgegraut und
  überbuchbar (erzeugen keine Konflikte).

## Modul 5 — Anmeldungen (fertig)

- **Drei Billing-Typen:** privat (Rechnung im Voraus pro Paket) · Firma (Rechnung an Kostenträger,
  im Voraus) · öffentliche Einrichtung (Rechnung erst im Nachhinein). Abweichender
  Rechnungsempfänger (z.B. Eltern) wählbar.
- **Probelektionen:** Status «Probe» — kein Guthaben, kein Preis, erscheinen in der
  Anwesenheitsliste; wandeln sich per Klick in feste Anmeldungen um (Paket wird aufgeladen).
- **Tarif automatisch nach Tageszeit** des Kursstarts (Zeitfenster aus den Tarifstufen,
  `src/lib/stammdaten/tarif.ts`), **Paketgrösse 14/15** aus der Tarifstufe, **Preis aus der
  Preisliste** (Kursart × Dauer × Tarifstufe) — jede Grösse einzeln übersteuerbar; Preis-
  abweichungen müssen dokumentiert werden (Pflichtfeld).
- **Lektionsguthaben als Konto mit Journal** (`GuthabenJournal`): der Stand ist die Summe der
  Journal-Deltas; Aufladungen, Korrekturen (begründungspflichtig) und Fehlzeiten —
  **unentschuldigt −1 / entschuldigt −0, das Büro entscheidet final**. Der automatische
  Verbrauch (−1 pro durchgeführter Lektion) kommt mit Modul 7 (fertig — siehe oben).
- **Paketende-Automatik:** nach der **12. von 14 / 13. von 15** Lektion erscheint die Anmeldung
  unter «Offene Paketentscheide»; «Teilnehmende(r) informieren» verschickt die Frage
  «fortfahren oder beenden?» (E-Mail bzw. Dev-Log), **Fortfahren** lädt das neue Paket auf und
  dokumentiert die Rechnungsauslösung (Versand folgt mit Modul 9; bei Behörden nur
  Verlängerung), **Beenden** schliesst die Anmeldung.

## Modul 4 — Kurse (fertig)

- **Fortlaufend, keine Start-/Enddaten:** Status **geplant · aktiv · pausiert · abgeschlossen ·
  abgesagt**; Teilnehmende buchen 14/15-Lektionen-Pakete (Modul 5) und verlängern.
- **Automatischer Kurscode** `DE-B2-6ER-SMIT01-01` = Sprache-Niveau-Kursart-Lehrkürzel +
  zweistellige Serial (pro Kombination, Lücken bleiben). Der **Niveau-Wechsel** beendet den
  laufenden Verlauf-Abschnitt, eröffnet den neuen und **passt den Kurscode an** (Serial bleibt
  möglichst gleich). Wechsel/Unterbrechungen kann auch die **Lehrperson selbst melden**
  (nur eigene Kurse); Büro setzt sie final.
- **Unterbrechungen** (Zeiträume, inklusive): im Planer **ausgegraut, Slots überbuchbar**.
- **Kursort:** intern (Standort → Standard-Raum, kann auch leer bleiben) oder **extern**
  («Kursort extern» — Firmenkurs vor Ort, erscheint nicht im Raumplaner).
- **Lehrpersonen sehen ihre Kurse** lesend; jede Änderung steht im Audit-Log.

## Modul 3 — Personenverwaltung (fertig)

**Eine Kartei für alle** (`/personen`): Interessent/innen, Teilnehmende, Kinder,
Lehrpersonen — sehen und pflegen dürfen Admin, Chef und Büro. Status-Laufbahn
**Interessent/in → aktiv → inaktiv** («Interessent» wird bei der Anmeldung,
Modul 5, weiterverwendet).

- **Pflichtfelder:** Anrede/Geschlecht (Herr/Frau/divers), Vor-/Nachname.
- **Kontakt:** E-Mail, Postadresse, **abweichende Rechnungsadresse**, zwei
  Telefonnummern mit «nutzt WhatsApp»/«nutzt Signal».
- **CRM-Notizen** mit automatisch erfasstem **Autor + Datum**; Löschen nur nach
  Bestätigung, jede Änderung im Audit-Log.
- **Kinder ↔ Eltern/Erziehungsberechtigte** als beidseitig verknüpfte Personen
  (dienen mit Modul 9 als Rechnungsempfänger).
- **Lehrpersonen:** Kürzel wird **automatisch aus Vor- + Nachname** abgeleitet
  (Sandra Mittal → `SMIT`), bei Doppelung mit zweistelligem Suffix (`SMIT01`);
  Kürzel bleiben nach Namensänderungen stabil, da Kurscodes darauf verweisen.
  **Qualifikationen** als Sprache × Niveau aus den Stammdaten — Sprachen/Niveaus
  mit Qualifikationen können nicht gelöscht, sondern nur archiviert werden.
- **Konto ↔ Person:** jedes Konto wird über `User.personId` einer Person
  zugeordnet (Verknüpfung im Benutzerdetail); die **E-Mail bleibt auf beiden
  Seiten synchron** (= Login). Der Bootstrap legt zum ersten Admin-Konto eine
  Person mit an.
- **Löschen nur wenn unbenutzt:** mit verknüpftem Konto, Familien-Verknüpfungen
  oder Qualifikationen ist keine Löschung möglich (Status «inaktiv» stattdessen).
  Die **Kurs-Historie** zeigt alle Anmeldungen der Person (Kurs, Status, Paket, Guthaben).

## Modul 2 — Stammdaten (fertig)

Pflegt ausschliesslich **Admin** (`/stammdaten`); Chef sieht lesend. Alles nach der
Regel: anlegen · aktivieren/deaktivieren · **löschen nur wenn unbenutzt** · archivieren
— jede Änderung steht im Audit-Log.

- **Standorte & Räume**: Hierarchie Standort → Etage → Raum (Raumname + Sitzplätze),
  Startdaten laut Pflichtenheft werden beim ersten Start automatisch angelegt
  (Raumnamen/Plätze sind Platzhalter bis zum gemeinsamen Setup).
- **Sprachen** (Name + Kürzel für Kurscodes), **Niveaus** (A1…C2, frei sortierbar),
  **Kursarten** (Einzel/2er/3er/4er/6er/Online/Firmenkurs — beliebig erweiterbar;
  Online: Raum optional, keine Teilnehmerzahl-Beschränkung pro Art konfigurierbar),
  **Lektionsdauern** (45/60/90 …).
- **Tarife**: Tarifstufen mit Paketgrösse (Hochtarif 14 / Niedertarif 15) und
  Zeitfenstern (Mittag/Abend) für die automatische Vorbelegung nach Tageszeit
  (Modul 5 kann das Büro jederzeit übersteuern). **Preisliste** je
  Kursart × Dauer × Tarifstufe — **jederzeitig anpassbar** (kein Jahres-Mechanismus).
- **Kostenträger**: Firmen + öffentliche Einrichtungen mit Kundennummer und
  Rechnungsadresse. Kursart/Dauer/Tarifstufe mit Preisen, Standort mit Etagen,
  Etage mit Räumen können nicht gelöscht werden (archivieren stattdessen).

### Löschen-Regeln (unbenutzt-Prüfung)

Kursart/Dauer/Tarifstufe mit Preisen, Standort mit Etagen, Etage mit Räumen können
nicht gelöscht werden (archivieren stattdessen). Kurse löschen nur ohne Anmeldungen
und Lektionen (sonst Status «abgesagt»/«abgeschlossen»); Personen mit Anmeldungen
sind ebenfalls löschgeschützt (DB-Restriktion; Rechnungen über `Restrict`).
Personen mit Honorar-Daten (Sätze in der Honorar-Matrix, Monats-Abrechnungen)
sind ebenfalls löschgeschützt (Status «inaktiv» stattdessen), Kursarten mit
Honorar-Sätzen ebenso.

## Modul 1 — Login & Rechtesystem (fertig)

- **5 Rollen** (Admin, Chef, Büro, Lehrperson, Kursteilnehmer), Mehrfachrollen möglich.
  Rollen vergibt ausschliesslich **Admin**; Büro darf Konten für Lehrpersonen/Teilnehmende anlegen.
- **Keine Selbstregistrierung** — Konten entstehen nur über `/benutzer/neu` (Büro/Admin)
  oder den Bootstrap (siehe unten).
- **Passwort-Politik**: min. 20 Zeichen mit Gross-/Kleinbuchstaben, Ziffer und Sonderzeichen;
  nach Erstvergabe/Admin-Reset wird ein Wechsel erzwungen (`mustChangePassword`).
- **Passwort-Reset per E-Mail-Link** (IONOS-SMTP, 60 Minuten gültig, Einmal-Token;
  nur SHA-256-Hashes in der Datenbank). Ohne SMTP-Konfiguration loggt die Entwicklung
  den Link in die Server-Konsole.
- **Sessions**: DB-gestützt, httpOnly-Cookie, 12 h Idle- / 30 Tage absolutes Limit,
  Verlängerung bei Aktivität; Admin kann Sitzungen beenden.
- **Brute-Force-Schutz**: 5 fehlgeschlagene Anmeldungen pro E-Mail bzw. 20 pro IP
  innerhalb von 15 Minuten sperren; Reset-Anfragen sind gedrosselt (3/Stunde pro E-Mail).
- **Audit-Log** für alle wichtigen Änderungen (Anmeldung, Konten, Rollen, Passwörter,
  Sitzungen) mit Akteur, IP und Zeit — sichtbar für Admin und Chef unter `/audit`.
- System-Invariante: es bleibt immer **mindestens eine aktive Admin-Person**.

### Erstes Admin-Konto (Bootstrap)

Da es keine Selbstregistrierung gibt, legt der Server beim Start automatisch das erste
Admin-Konto an, *wenn die Datenbank noch kein einziges Konto enthält* — Umgebungsvariablen
in Coolify (siehe `.env.example`):

```
BOOTSTRAP_ADMIN_EMAIL=...      # = Login
BOOTSTRAP_ADMIN_FIRST_NAME=...
BOOTSTRAP_ADMIN_LAST_NAME=...
BOOTSTRAP_ADMIN_PASSWORD=...   # Politik wie oben; Wechsel wird beim ersten Login erzwungen
```

Danach (oder wenn Variablen fehlen) tut der Bootstrap nichts — nachträgliche Änderungen
an den Variablen sind wirkungslos.

### E-Mail-Versand (IONOS)

`SMTP_HOST` (typisch `smtp.ionos.de`), `SMTP_PORT` (587 = STARTTLS), `SMTP_USER`,
`SMTP_PASS`, `MAIL_FROM` in Coolify setzen. Ohne Konfiguration: Entwicklung loggt die
Mails, Produktiv meldet den Fehler und bietet in der Benutzerverwaltung den manuellen
Passwort-Modus an.
