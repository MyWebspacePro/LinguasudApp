/**
 * Server-Start-Hook (Next.js Instrumentation): `register()` läuft einmal,
 * bevor der Server Anfragen annimmt — nach den Migrationen (Entrypoint).
 * Legt das erste Admin-Konto an, falls die Datenbank leer ist, und sorgt
 * einmalig für die Stammdaten-Startdaten (Modul 2).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapAdmin } = await import("@/lib/bootstrap");
  await bootstrapAdmin();
  const { seedStartdaten } = await import("@/lib/stammdaten/seed");
  await seedStartdaten();
}
