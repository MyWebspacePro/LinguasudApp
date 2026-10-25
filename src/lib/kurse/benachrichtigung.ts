import "server-only";

// Teilnehmenden-Benachrichtigung (Modul 6): bei Fixierung mit Zeit-/Raum-
// Änderung und bei Absagen werden alle angemeldeten Personen informiert.
// Ohne SMTP-Konfiguration loggt sendMail in der Entwicklung in die Konsole.

import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export interface BenachrichtigungResult {
  gesendet: number;
  /** Anmeldungen ohne E-Mail (können nicht informiert werden). */
  ohneEmail: number;
}

/**
 * Informiert alle aktiven und Probe-Anmeldungen eines Kurses per E-Mail.
 * `bestehend` beschreibt den bisherigen Termin (null = erstmalige Fixierung
 * einer Ausnahmezeit), `neu` den neuen.
 */
export async function informiereKursteilnehmende(input: {
  kursId: string;
  kursCode: string;
  betreff: string;
  intro: string;
  bestehend: string | null;
  neu: string;
}): Promise<BenachrichtigungResult> {
  const anmeldungen = await db.orm.public.Anmeldung
    .where({ kursId: input.kursId })
    .where((a) => a.status.in(["AKTIV", "PROBE"]))
    .include("person")
    .all();

  let gesendet = 0;
  let ohneEmail = 0;
  for (const anmeldung of anmeldungen) {
    const email = anmeldung.person?.email;
    if (!email) {
      ohneEmail++;
      continue;
    }
    const name = `${anmeldung.person.vorname} ${anmeldung.person.nachname}`;
    const body = `<p style="margin:0 0 8px;font-size:14px;">Hallo ${name},</p>
<p style="margin:0 0 8px;font-size:14px;">${input.intro}</p>
<table style="font-size:14px;color:#334155;">
  ${input.bestehend ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b;">Bisher:</td><td>${input.bestehend}</td></tr>` : ""}
  <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Neu:</td><td>${input.neu}</td></tr>
</table>
<p style="margin:12px 0 0;font-size:13px;color:#64748b;">Kurs: ${input.kursCode} · Sprachschule linguasud</p>`;
    const ergebnis = await sendMail({
      to: email,
      subject: input.betreff,
      text: `${input.intro}\n\n${input.bestehend ? `Bisher: ${input.bestehend}\n` : ""}Neu: ${input.neu}\n\nKurs: ${input.kursCode} · Sprachschule linguasud`,
      html: body,
    });
    if (ergebnis.delivered || ergebnis.devLogged) gesendet++;
  }
  return { gesendet, ohneEmail };
}
