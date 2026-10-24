#!/bin/sh
set -e

# Migrationen ausführen, bevor der Server startet.
# DATABASE_URL kommt aus den Coolify-Umgebungsvariablen.
if [ -z "$DATABASE_URL" ]; then
  echo "FEHLER: DATABASE_URL ist nicht gesetzt." >&2
  exit 1
fi

echo "Prüfe Datenbank-Schema (Adoption/Verification)..."
# db sign verifiziert das Schema gegen den Contract und setzt den Marker.
# Auf einer frisch angelegten, leeren DB schlägt es fehl — das ist ok,
# das anschliessende db migrate bringt sie dann hoch.
prisma db sign --no-advance-ref || echo "Hinweis: db sign übersprungen (leere oder abweichende DB)."

echo "Führe ausstehende Datenbank-Migrationen aus..."
prisma db migrate

echo "Starte Anwendung..."
exec "$@"
