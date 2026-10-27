import type { Metadata } from "next";
import Link from "next/link";
import { OeffentlichKopf } from "@/components/oeffentlich/OeffentlichKopf";

export const metadata: Metadata = {
  title: "Anfrage erhalten · Sprachschule linguasud",
};

/** Schlichte Erfolgsseite nach dem Absenden der Anfrage (Modul 13). */
export default function AnfrageErfolgPage() {
  return (
    <main className="flex min-h-svh flex-col px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <OeffentlichKopf
          titel="Besten Dank für Ihre Anfrage"
          untertitel="Wir haben Ihre Angaben erhalten."
        />
        <div className="card p-6">
          <p className="text-sm text-slate-700">
            Eine Bestätigung ist unterwegs an Ihre E-Mail-Adresse. Unser Büro meldet
            sich in den nächsten Tagen bei Ihnen — gerne mit einem Vorschlag für
            einen passenden Kurs.
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Sie möchten noch etwas ergänzen?{" "}
            <Link href="/anfrage" className="font-medium text-brand-700 hover:text-brand-800">
              Senden Sie einfach eine weitere Anfrage
            </Link>{" "}
            oder{" "}
            <Link href="/einstufungstest" className="font-medium text-brand-700 hover:text-brand-800">
              machen Sie den Einstufungstest
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
