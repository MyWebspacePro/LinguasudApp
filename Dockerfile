# LinguasudApp — Produktions-Image für Coolify
# Mehrstufiger Build: Abhängigkeiten → Build → schlankes Laufzeit-Image
# (Next.js standalone). Beim Start werden DB-Migrationen ausgeführt, bevor
# der Server hochfährt.

# ---------- 1. Abhängigkeiten ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- 2. Build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ kann leer sein (Git nimmt leere Ordner nicht auf) — für das
# COPY im Runtime-Stage muss der Ordner trotzdem existieren.
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy-DATABASE_URL genügt für den Build (keine Modelle werden beim Bauen gelesen)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Contract aus dem Schema kompilieren (ersetzt das frühere prisma generate)
RUN pnpm prisma contract emit && pnpm build

# ---------- 3. Laufzeit ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_DISABLE_TELEMETRY=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PATH="/opt/prisma-cli/node_modules/.bin:${PATH}"
RUN apk add --no-cache curl

# Standalone-Server + statische Dateien
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schema + Prisma-8-Konfiguration + Contract + Migrationspakete für den Start
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/migrations ./migrations

# Prisma-8-CLI isoliert installieren (npm, eigenes Verzeichnis) — ein npm
# install direkt in /app scheitert an der pnpm-Standalone-Struktur. Die
# CLI löst die Imports der prisma.config.ts ab /app auf, deshalb Symlinks
# für die drei Pakete in den (fast leeren) Standalone-node_modules; der
# Server selbst läuft komplett gebundelt und berührt sie nicht.
RUN mkdir -p /opt/prisma-cli \
 && cd /opt/prisma-cli \
 && npm install \
    prisma@8.0.0-rc.27 \
    @prisma/orm-postgres@8.0.0-rc.20 \
    @prisma/cli-engine@0.9.0 \
    dotenv@18.0.9 \
    --no-fund --no-audit \
 && mkdir -p /app/node_modules/@prisma \
 && ln -sfn /opt/prisma-cli/node_modules/dotenv /app/node_modules/dotenv \
 && ln -sfn /opt/prisma-cli/node_modules/@prisma/orm-postgres /app/node_modules/@prisma/orm-postgres \
 && ln -sfn /opt/prisma-cli/node_modules/@prisma/cli-engine /app/node_modules/@prisma/cli-engine

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
