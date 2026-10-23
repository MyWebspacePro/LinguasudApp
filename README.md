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
| ORM | **Prisma 6** (bewusst gepinnt) | Klassischer, stabiler Migrations-Workflow; Prisma 7 ist ein Neuanfang mit anderem Konzept und für den Produktivbetrieb (noch) nicht nötig |
| Tests | **Vitest** | |
| Versand | **Docker** (node:22-alpine, Standalone-Build) | Deployment über Coolify auf den VPS |

## Lokale Entwicklung

Voraussetzungen: Node 22, pnpm, Docker Desktop (für die Datenbank).

```bash
pnpm install          # Abhängigkeiten
pnpm db:up            # PostgreSQL als Container starten
cp .env.example .env  # falls noch nicht vorhanden (lokal vorkonfiguriert)
pnpm db:migrate       # Migrationen anwenden / neue erstellen
pnpm dev              # http://localhost:3000
```

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `pnpm build` | Produktions-Build |
| `pnpm test` / `pnpm test:watch` | Tests (Vitest) |
| `pnpm typecheck` | TypeScript-Prüfung |
| `pnpm lint` | ESLint |
| `pnpm db:studio` | Prisma Studio (DB ansehen) |
| `pnpm db:down` | Datenbank-Container stoppen |

## Deployment (Coolify)

1. **GitHub:** Push auf `main` (Repo `MyWebspacePro/LinguasudApp`) — Coolify
   deployt automatisch (Webhook). Tests laufen lokal; jeder Push geht live.
2. **Coolify-Ressourcen:**
   - PostgreSQL-Container (Datenbank)
   - App aus dem Dockerfile des Repos, Domain `linguasudapp.aiconso.eu`
3. **Umgebungsvariablen in Coolify** (siehe `.env.example`):
   `DATABASE_URL`, `APP_ENV=production`, `APP_URL`, später `SMTP_*` (IONOS) und
   QR-Rechnungs-/OpenRouter-Schlüssel.
4. Beim Containerstart führt der Entrypoint automatisch `prisma migrate deploy`
   aus; danach startet der Server. Healthcheck: `/api/health`.
5. **Backups:** Coolify-Datenbank-Backup täglich, ca. 14 Tage Aufbewahrung.

## Projektstruktur

```
prisma/            Datenbankschema + Migrationen (Modell-Module entstehen pro Modul)
src/app/           Seiten (Verwaltung, Portal, öffentliche Website) + API-Routen
src/lib/           geteilte Bibliothek (DB-Client, Env-Validierung, Domänenlogik)
docker-entrypoint.sh  Migrationen + Serverstart im Container
PFLICHTENHEFT.md   Anforderungen (verbindlich für die Umsetzung)
```
