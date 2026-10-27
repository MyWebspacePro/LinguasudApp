// Vorschau des KI-Ergebnisses (Modul 14) — bewusst ohne Server-Importe,
// damit sie im Client-Formular und auf der Detailseite gleich aussieht.

import type { KiErgebnis } from "@/lib/ki/logik";

function Absaetze({ text }: { text: string }) {
  const absaetze = text.split(/\n{2,}/).filter((a) => a.trim());
  return (
    <div className="space-y-2">
      {absaetze.map((absatz, index) => (
        <p key={index} className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
          {absatz.trim()}
        </p>
      ))}
    </div>
  );
}

export function KiVorschlagAnzeige({ ergebnis }: { modus: "STRUKTUR" | "FREI"; ergebnis: KiErgebnis }) {
  if ("text" in ergebnis) {
    return <Absaetze text={ergebnis.text} />;
  }

  if ("rohtext" in ergebnis) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-amber-700">
          Die Antwort war nicht strukturiert — Rohtext aus der KI-Antwort:
        </p>
        <Absaetze text={ergebnis.rohtext} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Lernziele</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {ergebnis.lernziele.map((ziel, index) => (
            <li key={index}>{ziel}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Ablauf</h3>
        <ol className="mt-2 space-y-3">
          {ergebnis.ablauf.map((schritt, index) => (
            <li key={index} className="rounded-md border border-line bg-white p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-slate-800">
                <span>{schritt.phase}</span>
                <span className="text-xs font-normal text-slate-500">{schritt.dauerMinuten} Min</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {schritt.beschreibung}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {ergebnis.materialien.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Materialien</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {ergebnis.materialien.map((material, index) => (
              <li key={index}>{material}</li>
            ))}
          </ul>
        </section>
      )}

      {ergebnis.hausaufgabe.trim() && (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Hausaufgabe</h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {ergebnis.hausaufgabe}
          </p>
        </section>
      )}
    </div>
  );
}
