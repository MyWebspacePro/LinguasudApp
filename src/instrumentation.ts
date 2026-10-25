/**
 * Server-Start-Hook (Next.js Instrumentation): `register()` läuft einmal,
 * bevor der Server Anfragen annimmt — nach den Migrationen (Entrypoint).
 * Legt das erste Admin-Konto an, falls die Datenbank leer ist, sorgt einmalig
 * für die Stammdaten-Startdaten (Modul 2) und startet den nächtlichen
 * Lektions-Job (Modul 6, rollierende Generierung 2 Wochen im Voraus).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapAdmin } = await import("@/lib/bootstrap");
  await bootstrapAdmin();
  const { seedStartdaten } = await import("@/lib/stammdaten/seed");
  await seedStartdaten();
  const { startLektionsJob } = await import("@/lib/kurse/lektionsjob");
  startLektionsJob();
  const { startAnwesenheitsJob } = await import("@/lib/anwesenheit/erinnerungsjob");
  startAnwesenheitsJob();
  const { startMahnJob } = await import("@/lib/rechnungen/mahnjob");
  startMahnJob();
}
