import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canAdminKi, canViewKi } from "@/lib/auth/permissions";
import { ladeKiLektionPdf } from "@/lib/ki/druck";

// Lektionsplan-PDF (Modul 14): /ki-generator/[lektionId]/pdf — Stabsrollen
// mit Zugriff auf die Lektion (eigene, geteilte oder Admin/Chef).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lektionId: string }> },
) {
  const { lektionId } = await params;
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewKi(roles)) {
    return new Response("Kein Zugriff auf KI-Lektionen.", { status: 403 });
  }

  try {
    const ladung = await ladeKiLektionPdf(lektionId, {
      userId: user.id,
      istAdmin: canAdminKi(roles),
    });
    if (!ladung) {
      return new Response("Lektion nicht gefunden oder kein Zugriff.", { status: 404 });
    }
    return new Response(new Uint8Array(ladung.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ladung.dateiname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("KI-Lektions-PDF fehlgeschlagen:", error);
    return new Response("Der Lektionsplan konnte nicht erzeugt werden.", { status: 500 });
  }
}
