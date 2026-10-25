import { requireStaff } from "@/lib/auth/session";
import { canManageHonorare } from "@/lib/auth/permissions";
import { roleList } from "@/lib/domain";
import { ladeHonorarPdf } from "@/lib/honorare/druck";

// Honorar-Beleg-PDF (Modul 11): /honorare/[lehrpersonId]/[monat]/pdf —
// nur Verwaltung mit Honorar-Rechten (Admin/Chef/Büro).
export async function GET(_request: Request, { params }: { params: Promise<{ lehrpersonId: string; monat: string }> }) {
  const { lehrpersonId, monat } = await params;
  const { user } = await requireStaff();
  if (!canManageHonorare(roleList(user.roles))) {
    return new Response("Kein Zugriff auf Honorar-Belege.", { status: 403 });
  }

  try {
    const { dateiname, bytes } = await ladeHonorarPdf(lehrpersonId, monat);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${dateiname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Honorar-PDF fehlgeschlagen:", error);
    return new Response(
      error instanceof Error ? error.message : "Honorar-Beleg konnte nicht erzeugt werden.",
      { status: 404 },
    );
  }
}
