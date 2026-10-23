#!/bin/sh
set -e

# Migrationen ausführen, bevor der Server startet.
# DATABASE_URL kommt aus den Coolify-Umgebungsvariablen.
if [ -z "$DATABASE_URL" ]; then
  echo "FEHLER: DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

echo "Führe Datenbank-Migrationen aus..."
prisma migrate deploy

# Erstes Admin-Konto anlegen, falls die Datenbank leer ist
# (BOOTSTRAP_ADMIN_* — siehe README). Fehler blockieren den Start nicht.
if [ -f scripts/bootstrap-admin.mjs ]; then
  node scripts/bootstrap-admin.mjs || echo "WARNUNG: Admin-Bootstrap fehlgeschlagen (Start wird fortgesetzt)."
fi

echo "Starte Anwendung..."
exec "$@"
