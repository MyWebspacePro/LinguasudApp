import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RequestMeta } from "@/lib/request";

/** Audit-Aktionen von Modul 1 (Namenskonvention: <entity>.<vorgang>). */
export const AUDIT_ACTIONS = {
  userBootstrap: "user.bootstrap",
  userLogin: "user.login",
  userLoginFailed: "user.login_failed",
  userLogout: "user.logout",
  userCreate: "user.create",
  userUpdate: "user.update",
  userRolesChange: "user.roles_change",
  userPasswordChange: "user.password_change",
  userPasswordResetRequested: "user.password_reset_requested",
  userPasswordResetCompleted: "user.password_reset_completed",
  userPasswordSetByAdmin: "user.password_set_by_admin",
  userInviteSent: "user.invite_sent",
  userSessionsRevoked: "user.sessions_revoked",
} as const;

export interface AuditInput {
  actor?: { id: string; email: string } | null;
  action: string;
  entity?: string;
  entityId?: string;
  summary: string;
  details?: Prisma.InputJsonValue;
  request?: RequestMeta;
}

/**
 * Schreibt einen Audit-Log-Eintrag. Audit-Einträge dürfen den aufrufenden
 * Vorgang nie abbrechen — Fehler werden daher nur geloggt.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? undefined,
        ip: input.request?.ip ?? null,
        userAgent: input.request?.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Audit-Log konnte nicht geschrieben werden:", error);
  }
}
