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
RUN pnpm prisma generate && pnpm build

# ---------- 3. Laufzeit ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache curl

# Prisma-CLI für Migrationen beim Start (exakt gepinnte Version)
RUN npm install -g prisma@6.19.3 --no-fund --no-audit

# Standalone-Server + statische Dateien
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schema für Migrationen
COPY --from=builder /app/prisma ./prisma

# Bootstrap-Skript für das erste Admin-Konto (Start ohne Konten)
COPY --from=builder /app/scripts ./scripts

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
