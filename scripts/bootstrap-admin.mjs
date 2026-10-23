#!/usr/bin/env node
// Bootstrap des ersten Admin-Kontos (keine Selbstregistrierung!).
// Läuft beim Containerstart nach den Migrationen. Legt genau dann ein Konto
// an, wenn die User-Tabelle noch leer ist — sonst tut es nichts.
//
// Umgebungsvariablen:
//   BOOTSTRAP_ADMIN_EMAIL      E-Mail (= Login) der ersten Admin-Person
//   BOOTSTRAP_ADMIN_FIRST_NAME Vorname
//   BOOTSTRAP_ADMIN_LAST_NAME  Nachname
//   BOOTSTRAP_ADMIN_PASSWORD   Initialpasswort (Politik: min. 20 Zeichen,
//                              Gross/Klein, Ziffer, Sonderzeichen; Wechsel
//                              wird beim ersten Login erzwungen)

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function checkPasswordPolicy(password) {
  const errors = [];
  if (password.length < 20) errors.push("mindestens 20 Zeichen");
  if (!/[a-z]/.test(password)) errors.push("einen Kleinbuchstaben");
  if (!/[A-Z]/.test(password)) errors.push("einen Grossbuchstaben");
  if (!/[0-9]/.test(password)) errors.push("eine Ziffer");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("ein Sonderzeichen");
  return errors;
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Bootstrap übersprungen: es existieren bereits Konten.");
    return;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() ?? "";
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() ?? "";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";

  const missing = [];
  if (!email) missing.push("BOOTSTRAP_ADMIN_EMAIL");
  if (!firstName) missing.push("BOOTSTRAP_ADMIN_FIRST_NAME");
  if (!lastName) missing.push("BOOTSTRAP_ADMIN_LAST_NAME");
  if (!password) missing.push("BOOTSTRAP_ADMIN_PASSWORD");
  if (missing.length > 0) {
    console.warn(
      `Bootstrap: Datenbank ist leer, aber es fehlen Umgebungsvariablen (${missing.join(", ")}).\n` +
        "Kein Login möglich! In Coolify setzen und Container neu starten.",
    );
    return;
  }

  const policyErrors = checkPasswordPolicy(password);
  if (policyErrors.length > 0) {
    console.warn(
      `Bootstrap: BOOTSTRAP_ADMIN_PASSWORD erfüllt die Passwort-Politik nicht (braucht ${policyErrors.join(", ")}).\n` +
        "Kein Konto angelegt. Passwort anpassen und Container neu starten.",
    );
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      roles: [Role.ADMIN],
      passwordHash: await bcrypt.hash(password, 12),
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

  console.log(`Bootstrap: Admin-Konto "${email}" angelegt (Passwortwechsel beim ersten Login erzwungen).`);
}

main()
  .catch((error) => {
    // Bootstrap darf den Start des Containers nie blockieren.
    console.error("Bootstrap fehlgeschlagen:", error);
  })
  .finally(() => prisma.$disconnect());
