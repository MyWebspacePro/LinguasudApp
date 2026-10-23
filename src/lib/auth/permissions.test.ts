import { describe, expect, it } from "vitest";
import {
  canAssignRoles,
  canEditUser,
  canViewAuditLog,
  canViewUsers,
  hasRole,
  isStaff,
  landingRoute,
} from "./permissions";

describe("Rollen-Prädikate", () => {
  it("erkennt Rollen und Mehrfachrollen", () => {
    expect(hasRole(["ADMIN"], "ADMIN")).toBe(true);
    expect(hasRole(["LEHRPERSON", "TEILNEHMER"], "TEILNEHMER")).toBe(true);
    expect(hasRole(["BUERO"], "ADMIN")).toBe(false);
  });

  it("Teilnehmer ohne Stabsrolle sind kein Stab", () => {
    expect(isStaff(["TEILNEHMER"])).toBe(false);
    expect(isStaff(["TEILNEHMER", "LEHRPERSON"])).toBe(true);
    expect(isStaff(["BUERO"])).toBe(true);
  });
});

describe("canViewUsers / canViewAuditLog", () => {
  it("Benutzerliste: Admin, Chef, Büro — nicht Lehrperson/Teilnehmer", () => {
    expect(canViewUsers(["ADMIN"])).toBe(true);
    expect(canViewUsers(["CHEF"])).toBe(true);
    expect(canViewUsers(["BUERO"])).toBe(true);
    expect(canViewUsers(["LEHRPERSON"])).toBe(false);
    expect(canViewUsers(["TEILNEHMER"])).toBe(false);
  });

  it("Audit-Log: nur Admin und Chef", () => {
    expect(canViewAuditLog(["ADMIN"])).toBe(true);
    expect(canViewAuditLog(["CHEF"])).toBe(true);
    expect(canViewAuditLog(["BUERO", "LEHRPERSON"])).toBe(false);
  });
});

describe("canAssignRoles (Rollenvergabe: nur Admin)", () => {
  it("Admin darf alle Kombinationen", () => {
    expect(canAssignRoles(["ADMIN"], ["CHEF", "BUERO"])).toBe(true);
    expect(canAssignRoles(["ADMIN", "LEHRPERSON"], ["TEILNEHMER"])).toBe(true);
  });

  it("Büro darf nur Lehrperson/Teilnehmer vergeben", () => {
    expect(canAssignRoles(["BUERO"], ["TEILNEHMER"])).toBe(true);
    expect(canAssignRoles(["BUERO"], ["LEHRPERSON", "TEILNEHMER"])).toBe(true);
    expect(canAssignRoles(["BUERO"], ["ADMIN"])).toBe(false);
    expect(canAssignRoles(["BUERO"], ["TEILNEHMER", "CHEF"])).toBe(false);
    expect(canAssignRoles(["BUERO"], ["BUERO"])).toBe(false);
  });

  it("Chef/Lehrperson/Teilnehmer dürfen nichts vergeben", () => {
    expect(canAssignRoles(["CHEF"], ["TEILNEHMER"])).toBe(false);
    expect(canAssignRoles(["LEHRPERSON"], ["TEILNEHMER"])).toBe(false);
    expect(canAssignRoles(["TEILNEHMER"], ["TEILNEHMER"])).toBe(false);
  });
});

describe("canEditUser", () => {
  it("Admin darf alles bearbeiten", () => {
    expect(canEditUser(["ADMIN"], ["CHEF", "ADMIN"])).toBe(true);
    expect(canEditUser(["ADMIN"], ["TEILNEHMER"])).toBe(true);
  });

  it("Büro bearbeitet nur Konten mit Büro-vergebaren Rollen", () => {
    expect(canEditUser(["BUERO"], ["TEILNEHMER"])).toBe(true);
    expect(canEditUser(["BUERO"], ["LEHRPERSON"])).toBe(true);
    expect(canEditUser(["BUERO"], ["TEILNEHMER", "LEHRPERSON"])).toBe(true);
    expect(canEditUser(["BUERO"], ["ADMIN"])).toBe(false);
    expect(canEditUser(["BUERO"], ["TEILNEHMER", "CHEF"])).toBe(false);
  });

  it("Chef ist lesend", () => {
    expect(canEditUser(["CHEF"], ["TEILNEHMER"])).toBe(false);
  });
});

describe("landingRoute", () => {
  it("Stabsrollen starten in der Verwaltung", () => {
    expect(landingRoute(["ADMIN"])).toBe("/dashboard");
    expect(landingRoute(["BUERO"])).toBe("/dashboard");
    expect(landingRoute(["LEHRPERSON"])).toBe("/dashboard");
    expect(landingRoute(["TEILNEHMER", "LEHRPERSON"])).toBe("/dashboard");
  });

  it("reine Kursteilnehmende starten im Portal", () => {
    expect(landingRoute(["TEILNEHMER"])).toBe("/portal");
  });
});
