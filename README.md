# LinguasudApp

Verwaltungssoftware für die **Sprachschule linguasud.com** — Kurse, Lehrkräfte,
Büro, Kursteilnehmende, Raumplanung, Anwesenheit, Rechnungen (QR),
Kursbestätigungen, Honorare, Vermietung und öffentliche Website.

Die vollständigen Anforderungen stehen im **[PFLICHTENHEFT.md](./PFLICHTENHEFT.md)**.

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
  Die **Kurs-Historie** folgt mit Modul 4/5.

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
  Rechnungsadresse.

### Löschen-Regeln (unbenutzt-Prüfung)

Kursart/Dauer/Tarifstufe mit Preisen, Standort mit Etagen, Etage mit Räumen können
nicht gelöscht werden (archivieren stattdessen). Weitere Nutzungsprüfen (Kurse,
Lektionen, Rechnungen) entstehen mit den Modulen 4–9.

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
