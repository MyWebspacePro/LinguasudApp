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

echo "Starte Anwendung..."
exec "$@"
