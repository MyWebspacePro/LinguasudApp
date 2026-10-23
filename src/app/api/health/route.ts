import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Liveness/Readiness-Endpunkt für Coolify.
 * Antwortet immer 200 (Prozess lebt); der Datenbankstatus wird informativ
 * mitgeliefert, damit ein fehlkonfigurierter Container im Log auffällt.
 */
export async function GET() {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    // bewusst geschluckt: Health soll den Prozess, nicht die DB, prüfen
  }

  return NextResponse.json(
    { status: "ok", db, timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
