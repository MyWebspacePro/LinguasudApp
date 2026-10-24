import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { canManageStammdaten, canViewStammdaten } from "@/lib/auth/permissions";
import { FLAT_ENTITIES, type FlatEntityKey } from "@/lib/stammdaten/entities";
import { FlatEntityManager, type FlatRow } from "./FlatEntityManager";

/**
 * Geteilte Server-Seite für die flachen Stammdaten (Sprachen, Niveaus,
 * Kursarten, Dauern, Kostenträger): lädt die Zeilen und rendert den
 * generischen Manager.
 */
export async function FlatEntityPage({ entity }: { entity: FlatEntityKey }) {
  const { user } = await requireStaff();
  const roles = user.roles as Role[];
  if (!canViewStammdaten(roles)) {
    redirect("/dashboard");
  }

  const config = FLAT_ENTITIES[entity];
  let rows: FlatRow[] = [];

  if (entity === "sprache") {
    const data = await prisma.sprache.findMany({ orderBy: { name: "asc" } });
    rows = data.map((r) => ({
      id: r.id,
      active: r.active,
      archived: Boolean(r.archivedAt),
      values: { name: r.name, code: r.code },
    }));
  } else if (entity === "niveau") {
    const data = await prisma.niveau.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
    rows = data.map((r) => ({
      id: r.id,
      active: r.active,
      archived: Boolean(r.archivedAt),
      values: { code: r.code, name: r.name, sortOrder: r.sortOrder },
    }));
  } else if (entity === "kursart") {
    const data = await prisma.kursart.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    rows = data.map((r) => ({
      id: r.id,
      active: r.active,
      archived: Boolean(r.archivedAt),
      values: {
        name: r.name,
        maxParticipants: r.maxParticipants,
        requiresRoom: r.requiresRoom,
        sortOrder: r.sortOrder,
      },
    }));
  } else if (entity === "dauer") {
    const data = await prisma.lektionsdauer.findMany({ orderBy: { minuten: "asc" } });
    rows = data.map((r) => ({
      id: r.id,
      active: r.active,
      archived: Boolean(r.archivedAt),
      values: { minuten: r.minuten },
    }));
  } else {
    const data = await prisma.kostentraeger.findMany({ orderBy: { name: "asc" } });
    rows = data.map((r) => ({
      id: r.id,
      active: r.active,
      archived: Boolean(r.archivedAt),
      values: {
        art: r.art,
        name: r.name,
        kundennummer: r.kundennummer,
        strasse: r.strasse,
        plz: r.plz,
        ort: r.ort,
      },
    }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{config.label}</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Anlegen · aktivieren/deaktivieren · löschen (nur wenn unbenutzt) · archivieren.
        </p>
      </div>
      <FlatEntityManager config={config} rows={rows} canManage={canManageStammdaten(roles)} />
    </div>
  );
}
