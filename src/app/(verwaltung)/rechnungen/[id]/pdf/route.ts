import { redirect } from "next/navigation";
import type { Role } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageAnmeldungen } from "@/lib/auth/permissions";
import { ladeRechnungsPdf } from "@/lib/rechnungen/druck";

// Rechnungs-PDF (Modul 9): /rechnungen/[id]/pdf liefert das Dokument mit
// QR-Zahlteil (nur Admin/Chef/Büro).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireStaff();
  if (!canManageAnmeldungen(user.roles as Role[])) redirect("/dashboard");

  try {
    const { nummer, bytes } = await ladeRechnungsPdf(id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Rechnung-${nummer}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Rechnungs-PDF fehlgeschlagen:", error);
    return new Response(
      error instanceof Error ? error.message : "Rechnungs-PDF konnte nicht erzeugt werden.",
      { status: 500 },
    );
  }
}
