import "server-only";

// Drossel öffentlicher Formulare (Modul 13): fensterbasierte Auswertung pro
// E-Mail/IP — die rein funktionale Entscheidung kommt aus dem Brute-Force-
// Schutz (isRateLimited), nur die Ereignisse liegen in einer eigenen Tabelle
// (PublicFormVersuch), da öffentliche Formulare kein Login sind.

import { db, toDbTime } from "@/lib/db";
import { isRateLimited } from "@/lib/auth/bruteforce";
import { ANFRAGE_DROSSEL_OPTIONS, type AnfrageDrosselOptions } from "./logik";

/** Alte Versuche werden beiläufig mitgeräumt (Retention wie Auth-Ereignisse). */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Registriert eine Einreichung (jeder Absendeversuch zählt aufs Fenster). */
export async function registriereVersuch(form: string, email: string, ip: string | null): Promise<void> {
  await db.orm.public.PublicFormVersuch.create({ form, email, ip });
  const cutoff = toDbTime(new Date(Date.now() - RETENTION_MS));
  await db.orm.public.PublicFormVersuch.where((e) => e.createdAt.lt(cutoff)).deleteAll();
}

/** Ist das Formular für diese E-Mail/IP im Fenster gesperrt? */
export async function istDrosselAktiv(
  form: string,
  email: string,
  ip: string | null,
  options: AnfrageDrosselOptions = ANFRAGE_DROSSEL_OPTIONS,
): Promise<boolean> {
  const since = toDbTime(new Date(Date.now() - options.windowMs));
  const rows = await db.orm.public.PublicFormVersuch
    .where((e) => e.form.eq(form))
    .where((e) => e.createdAt.gte(since))
    .select("email", "ip", "createdAt")
    .all();
  return isRateLimited(
    rows.map((e) => ({ email: e.email, ip: e.ip, createdAt: new Date(e.createdAt) })),
    email,
    ip,
    options,
  );
}
