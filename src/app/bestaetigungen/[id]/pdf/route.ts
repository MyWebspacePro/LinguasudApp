import { requireAuth } from "@/lib/auth/session";
import { canManageKurse } from "@/lib/auth/permissions";
import { roleList } from "@/lib/domain";
import { db } from "@/lib/db";
import { ladeBestaetigungsPdf } from "@/lib/bestaetigungen/druck";

// Kursbestätigungs-PDF (Modul 10): /bestaetigungen/[id]/pdf — für die
// Verwaltung (Admin/Chef/Büro) und für Teilnehmende die eigene Bestätigung
// (Rechte-Check auf die eigene Person, Pflichtenheft: Selbstdrucken im Portal).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAuth();

  const bestaetigung = await db.orm.public.Kursbestaetigung.where({ id }).first();
  if (!bestaetigung) {
    return new Response("Kursbestätigung nicht gefunden.", { status: 404 });
  }
  if (!canManageKurse(roleList(user.roles)) && bestaetigung.personId !== user.personId) {
    // Fremde Bestätigungen sind nicht einsehbar (404 statt 403: keine IDs verraten).
    return new Response("Kursbestätigung nicht gefunden.", { status: 404 });
  }

  try {
    const { dateiname, bytes } = await ladeBestaetigungsPdf(id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${dateiname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Kursbestätigungs-PDF fehlgeschlagen:", error);
    return new Response(
      error instanceof Error ? error.message : "Kursbestätigungs-PDF konnte nicht erzeugt werden.",
      { status: 500 },
    );
  }
}
