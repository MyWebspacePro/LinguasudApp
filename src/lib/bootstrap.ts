import "server-only";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { passwordPolicyErrors } from "@/lib/auth/password-policy";

/**
 * Erstes Admin-Konto (Bootstrap) — es gibt keine Selbstregistrierung.
 * Wird beim Serverstart aufgerufen (instrumentation.ts) und legt genau dann
 * ein Konto an, wenn die User-Tabelle noch leer ist. Umgebungsvariablen:
 * BOOTSTRAP_ADMIN_EMAIL / _FIRST_NAME / _LAST_NAME / _PASSWORD.
 * Muss den Serverstart nie abbrechen; Fehler werden nur protokolliert.
 */
export async function bootstrapAdmin(): Promise<void> {
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log("Bootstrap übersprungen: es existieren bereits Konten.");
      return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() ?? "";
    const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() ?? "";
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";

    const missing = [
      !email && "BOOTSTRAP_ADMIN_EMAIL",
      !firstName && "BOOTSTRAP_ADMIN_FIRST_NAME",
      !lastName && "BOOTSTRAP_ADMIN_LAST_NAME",
      !password && "BOOTSTRAP_ADMIN_PASSWORD",
    ].filter(Boolean);

    if (missing.length > 0) {
      console.warn(
        `Bootstrap: Datenbank ist leer, aber es fehlen Umgebungsvariablen (${missing.join(", ")}). ` +
          "Kein Login möglich! In Coolify setzen und neu deployen.",
      );
      return;
    }

    const policy = passwordPolicyErrors(password);
    if (policy.length > 0) {
      console.warn(
        `Bootstrap: BOOTSTRAP_ADMIN_PASSWORD erfüllt die Passwort-Politik nicht (braucht ${policy.join(", ")}). ` +
          "Kein Konto angelegt. Passwort anpassen und neu deployen.",
      );
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        roles: ["ADMIN"],
        passwordHash: await hashPassword(password),
        isActive: true,
        mustChangePassword: true,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: "user.bootstrap",
        entity: "user",
        entityId: user.id,
        summary: `Erstes Admin-Konto eingerichtet: ${firstName} ${lastName} (${email})`,
        details: { roles: ["ADMIN"], bootstrap: true },
      },
    });

    console.log(
      `Bootstrap: Admin-Konto "${email}" angelegt (Passwortwechsel beim ersten Login erzwungen).`,
    );
  } catch (error) {
    // Bootstrap darf den Start nie blockieren.
    console.error("Admin-Bootstrap fehlgeschlagen:", error);
  }
}
