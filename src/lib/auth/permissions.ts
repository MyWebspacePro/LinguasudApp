// Rollen- und Rechtelogik (pur, gut testbar) nach dem Pflichtenheft:
// - 5 Rollen, Mehrfachrollen möglich
// - Rechte/Rollen vergeben: nur Admin
// - Konten anlegen: Büro und Admin (Büro darf nur Teilnehmende/Lehrpersonen verwalten)
// - Chef: alles sehen — auch Benutzerverwaltung (lesend) und Audit-Log

import type { Role } from "@/lib/db";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  CHEF: "Chef",
  BUERO: "Büro",
  LEHRPERSON: "Lehrperson",
  TEILNEHMER: "Kursteilnehmer",
};

/** Reihenfolge wie im Pflichtenheft (für Badges/Auswahl). */
export const ALL_ROLES: Role[] = ["ADMIN", "CHEF", "BUERO", "LEHRPERSON", "TEILNEHMER"];

/** Rollen, die Büro vergeben bzw. anlegen darf (ohne heikle Rollen). */
export const BUERO_ASSIGNABLE_ROLES: readonly Role[] = ["LEHRPERSON", "TEILNEHMER"];

export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}

export function isStaff(roles: Role[]): boolean {
  return roles.some((r) => r !== "TEILNEHMER");
}

/** Benutzerliste sehen: Admin, Chef, Büro. */
export function canViewUsers(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/** Audit-Log sehen: Admin und Chef. */
export function canViewAuditLog(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF");
}

/** Stammdaten pflegen (Modul 2): nur Admin. */
export function canManageStammdaten(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN");
}

/** Stammdaten sehen: Admin und Chef (lesend). */
export function canViewStammdaten(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF");
}

/** Personen-Kartei sehen (Modul 3): Admin, Chef, Büro. */
export function canViewPersonen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Personen-Kartei pflegen: Büro operativ; Chef darf «alles sehen/bearbeiten
 * ausser Rechtevergabe»; Admin ohnehin.
 */
export function canManagePersonen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

// ——— Module 4–6: Kurse, Anmeldungen, Planer ————————————————————————

/**
 * Kurse sehen (Modul 4): Stabsrollen voll; Lehrpersonen sehen ihre eigenen
 * Kurse (Scoping im Query), reine Teilnehmende nicht.
 */
export function canViewKurse(roles: Role[]): boolean {
  return isStaff(roles);
}

/** Kurse/Anmeldungen pflegen: Admin, Chef, Büro (Lehrpersonen nur melden). */
export function canManageKurse(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/** Anmeldungen sehen/pflegen (Modul 5): Admin, Chef, Büro. */
export function canViewAnmeldungen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

export function canManageAnmeldungen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Raumplaner sehen (Modul 6): Stabsrollen; Lehrpersonen lesend + melden,
 * reine Teilnehmende nicht.
 */
export function canViewPlaner(roles: Role[]): boolean {
  return isStaff(roles);
}

/** Lektionen verschieben/fixieren/absagen: nur das Büro (inkl. Admin/Chef). */
export function canManagePlaner(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Dienst- & Urlaubsplanung Büro (Modul 8): eigene Ansicht (nicht im
 * Raumplaner), nur Admin/Chef/Büro — reine Lehrpersonen organisieren sich
 * selbst, reine Teilnehmende sehen nichts.
 */
export function canManageBueroplan(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Honorarabrechnung (Modul 11): Büro-Operativ (Muster canManageAnmeldungen) —
 * Honorar-Matrix, Monats-Workflow und Beleg; Auswertungen sieht der Chef.
 */
export function canViewHonorare(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

export function canManageHonorare(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Raumvermietung (Modul 12): Büro-Operativ (Muster canManageAnmeldungen) —
 * Mieterkartei, Vermietungen, Serien und Rechnungs-Entwürfe aus der
 * Vermietung. Die Blöcke selbst sieht jede Stabsrolle im Raumplaner.
 */
export function canViewVermietung(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

export function canManageVermietung(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/**
 * Anfragen & Aufgaben (Modul 13): Büro-Operativ (Muster canManageAnmeldungen)
 * — Anfragen-Verwaltung mit Zuordnung, Aufgaben-System und Fragenkatalog
 * separat über canManageStammdaten (Admin).
 */
export function canViewAnfragen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

export function canManageAnfragen(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN") || hasRole(roles, "CHEF") || hasRole(roles, "BUERO");
}

/** Darf dieser Akteur dem Ziel diese Rollen zuweisen? */
export function canAssignRoles(actorRoles: Role[], targetRoles: Role[]): boolean {
  if (hasRole(actorRoles, "ADMIN")) return true;
  if (hasRole(actorRoles, "BUERO")) {
    return targetRoles.every((r) => BUERO_ASSIGNABLE_ROLES.includes(r));
  }
  return false;
}

/** Darf dieser Akteur das Konto (Namen, Rollen, Status, Passwort) bearbeiten? */
export function canEditUser(actorRoles: Role[], targetRoles: Role[]): boolean {
  if (hasRole(actorRoles, "ADMIN")) return true;
  if (hasRole(actorRoles, "BUERO")) {
    // Büro fasst nur Konten an, deren Rollen es selbst vergeben dürfte.
    return targetRoles.every((r) => BUERO_ASSIGNABLE_ROLES.includes(r));
  }
  return false;
}

/** Startseite nach dem Login: Verwaltung für Stabsrollen, sonst Teilnehmer-Portal. */
export function landingRoute(roles: Role[]): string {
  return isStaff(roles) ? "/dashboard" : "/portal";
}
