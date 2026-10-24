import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Liveness/Readiness-Endpunkt für Coolify.
 * Antwortet immer 200 (Prozess lebt); der Datenbankstatus wird informativ
 * mitgeliefert, damit ein fehlkonfigurierter Container im Log auffällt.
 */
export async function GET() {
  let dbState: "up" | "down" = "down";
  try {
    const plan = db.raw.sql`SELECT 1 AS one`
      .returnsRow({ one: "pg/int@1" })
      .build();
    await db.query(plan);
    dbState = "up";
  } catch {
    // bewusst geschluckt: Health soll den Prozess, nicht die DB, prüfen
  }

  return NextResponse.json(
    { status: "ok", db: dbState, timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
