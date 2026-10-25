import "server-only";

// Mahnungs-Versand (Modul 9): Stufe 1 = freundliche Erinnerung, Stufe 2 =
// Mahnung. Wird von der manuellen Büro-Action und vom Mahn-Job verwendet;
// jede Stufe wird genau versendet, mahnStufe/letzteMahnAt werden gesetzt.

import { db, toDbTime } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { restbetrag } from "./logik";

export async function versendeMahnung(
  rechnungId: string,
  stufe: 1 | 2,
): Promise<{ versendet: boolean; hinweis: string }> {
  const rechnung = await db.orm.public.Rechnung.where({ id: rechnungId }).first();
  if (!rechnung) return { versendet: false, hinweis: " (Rechnung nicht gefunden)" };

  const zahlungen = await db.orm.public.Zahlung.where({ rechnungId }).all();
  const rest = restbetrag(
    String(rechnung.totalChf),
    zahlungen.map((z) => String(z.betragChf)),
  );

  const titel = stufe === 1 ? "Freundliche Erinnerung" : "Mahnung";
  const betreff = `${titel}: Rechnung ${rechnung.nummer} — Sprachschule linguasud`;
  const text =
    stufe === 1
      ? `Guten Tag\n\nWir möchten Sie freundlich daran erinnern, dass die Rechnung ${rechnung.nummer} über ${rechnung.totalChf} CHF fällig war.\nOffener Betrag: ${rest} CHF.\n\nFreundliche Grüsse\nSprachschule linguasud\n`
      : `Guten Tag\n\nTrotz Fälligkeit ist die Rechnung ${rechnung.nummer} über ${rechnung.totalChf} CHF noch unbezahlt.\nOffener Betrag: ${rest} CHF. Wir bitten Sie, den Betrag umgehend zu begleichen.\n\nFreundliche Grüsse\nSprachschule linguasud\n`;

  let fehler: string | null = null;
  const email = rechnung.empfaengerEmail;
  if (email) {
    const ergebnis = await sendMail({
      to: email,
      subject: betreff,
      text,
      html: `<p style="font-size:14px;white-space:pre-line;">${text.trim().replace(/\n/g, "<br>")}</p>`,
    });
    if (!ergebnis.delivered) fehler = ergebnis.devLogged ? "dev-log" : ergebnis.error ?? "unbekannt";
  } else {
    fehler = "keine E-Mail-Adresse";
  }

  await db.orm.public.Mahnung.create({
    rechnungId,
    stufe,
    email: email ?? "(keine E-Mail)",
    fehler,
  });
  await db.orm.public.Rechnung.where({ id: rechnungId }).update({
    mahnStufe: stufe,
    letzteMahnAt: toDbTime(new Date()),
  });

  return { versendet: fehler === null, hinweis: fehler === null ? "" : ` (${fehler})` };
}
