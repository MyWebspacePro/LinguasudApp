// Zentrale Datenbank-Exporte (Prisma 8) — nur für Servercode ("server-only"
// Datenzugriff). Der Client liegt in src/prisma/db.ts (wird von
// `prisma contract emit` verwaltet); pures Domain-Zeug (Typen, Konverter)
// liegt in src/lib/domain.ts und wird von Client-Components direkt von dort
// importiert, damit der DB-Client nie in den Browser-Bundle gelangt.

import { db } from "@/prisma/db";

export { db };
export * from "@/lib/domain";
