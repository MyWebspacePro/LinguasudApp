/**
 * Server-Start-Hook (Next.js Instrumentation): `register()` läuft einmal,
 * bevor der Server Anfragen annimmt — nach den Migrationen (Entrypoint).
 * Hier wird das erste Admin-Konto gelegt, falls die Datenbank leer ist.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapAdmin } = await import("@/lib/bootstrap");
  await bootstrapAdmin();
}
