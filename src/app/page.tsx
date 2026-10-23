const buildSteps = [
  { label: "Projektgerüst", done: true },
  { label: "Modul 1 · Login & Rechte", done: false },
  { label: "Modul 2 · Stammdaten", done: false },
  { label: "Modul 3 · Personen", done: false },
  { label: "Module 4–6 · Kurse, Anmeldungen, Planer", done: false },
  { label: "Module 7–16 · Betrieb, Finanzen, Website", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-6 py-10">
      <div className="rounded-lg border border-line bg-paper shadow-sm">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-700 text-sm font-semibold text-white">
            L
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold text-slate-900">
              Linguasud Verwaltung
            </h1>
            <p className="text-sm text-slate-500">
              Sprachschule linguasud.com · Verwaltungs-App
            </p>
          </div>
        </div>

        <div className="px-6 py-4">
          <h2 className="text-sm font-medium text-slate-700">
            Aufbau nach Pflichtenheft
          </h2>
          <ul className="mt-2 space-y-1.5">
            {buildSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className={
                    step.done
                      ? "flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-[9px] leading-none text-white"
                      : "h-4 w-4 rounded-full border border-line"
                  }
                >
                  {step.done ? "✓" : ""}
                </span>
                <span className={step.done ? "text-slate-700" : "text-slate-500"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-line px-6 py-3 text-xs text-slate-400">
          Anforderungen: PFLICHTENHEFT.md · Deployment über Coolify auf
          linguasudapp.aiconso.eu
        </p>
      </div>
    </main>
  );
}
