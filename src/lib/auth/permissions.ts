// Rollen- und Rechtelogik (pur, gut testbar) nach dem Pflichtenheft:
// - 5 Rollen, Mehrfachrollen möglich
// - Rechte/Rollen vergeben: nur Admin
// - Konten anlegen: Büro und Admin (Büro darf nur Teilnehmende/Lehrpersonen verwalten)
// - Chef: alles sehen — auch Benutzerverwaltung (lesend) und Audit-Log

import type { Role } from "@prisma/client";

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
