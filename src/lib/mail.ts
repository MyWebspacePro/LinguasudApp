// E-Mail-Versand über IONOS SMTP (Zugangsdaten als Umgebungsvariablen).
// Ohne SMTP-Konfiguration: in der Entwicklung wird die Mail in die Konsole
// geloggt (Reset-Links bleiben so lokal testbar), im Produktivbetrieb wird
// der Fehler geloggt und gemeldet.

import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { getEnv, isMailConfigured } from "@/lib/env";

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  delivered: boolean;
  /** true, wenn die Mail statt dessen in der Entwicklung in die Konsole geloggt wurde. */
  devLogged: boolean;
  error?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const env = getEnv();
    if (!isMailConfigured(env)) {
      throw new Error("SMTP ist nicht konfiguriert (SMTP_HOST/SMTP_USER/SMTP_PASS fehlen).");
    }
    const port = env.SMTP_PORT;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      // 587 (IONOS-Standard): STARTTLS nach Verbindung; 465: SMTPS.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
    });
  }
  return transporter;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const env = getEnv();

  if (!isMailConfigured(env)) {
    if (env.APP_ENV === "development") {
      console.log(
        `\n[mail:dev] Kein SMTP konfiguriert — Mail würde gehen an: ${input.to}\n` +
          `Betreff: ${input.subject}\n---\n${input.text}\n---\n`,
      );
      return { delivered: false, devLogged: true };
    }
    console.error("E-Mail-Versand fehlgeschlagen: SMTP ist nicht konfiguriert.");
    return { delivered: false, devLogged: false, error: "SMTP nicht konfiguriert" };
  }

  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { delivered: true, devLogged: false };
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error);
    return {
      delivered: false,
      devLogged: false,
      error: error instanceof Error ? error.message : "Unbekannter SMTP-Fehler",
    };
  }
}

// ——— Vorlagen ———————————————————————————————————————————————————

function brandWrapper(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#faf9f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e4df;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#712544;padding:16px 24px;">
              <span style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:0.02em;">Linguasud Verwaltung</span>
            </td>
          </tr>
          <tr><td style="padding:24px;">
            <h1 style="margin:0 0 12px;font-size:17px;color:#0f172a;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:14px 24px;border-top:1px solid #e7e4df;font-size:12px;color:#94a3b8;">
            Sprachschule linguasud · Diese E-Mail wurde automatisch erstellt.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buttonHtml(url: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${url}" style="display:inline-block;background:#712544;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">${label}</a></p>
  <p style="margin:8px 0;font-size:13px;color:#475569;">Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in den Browser:<br>
  <a href="${url}" style="color:#712544;word-break:break-all;">${url}</a></p>`;
}

/** Passwort-zurücksetzen-/Einladungs-Mail mit Einmal-Link (1 Stunde gültig). */
export function passwordResetMail(to: string, name: string, url: string, isInvite: boolean): MailInput {
  const anrede = name ? `Hallo ${name},` : "Hallo,";
  const intro = isInvite
    ? "für Sie wurde ein Zugang zur Linguasud-Verwaltung eingerichtet. Bitte setzen Sie damit Ihr persönliches Passwort."
    : "wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Sie können Ihr Passwort über den folgenden Link neu setzen.";
  const title = isInvite ? "Willkommen bei Linguasud" : "Passwort zurücksetzen";
  const body = `<p style="margin:0 0 8px;font-size:14px;">${anrede}</p>
    <p style="margin:0 0 8px;font-size:14px;">${intro}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Der Link ist 60 Minuten gültig und kann nur einmal verwendet werden.</p>
    ${buttonHtml(url, isInvite ? "Passwort festlegen" : "Passwort neu setzen")}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Wenn Sie diese Anfrage nicht ausgelöst haben, können Sie diese E-Mail ignorieren — es werden keine Änderungen vorgenommen.</p>`;
  const text = `${anrede}\n\n${intro}\n\nLink (60 Minuten gültig): ${url}\n\nWenn Sie diese Anfrage nicht ausgelöst haben, ignorieren Sie diese E-Mail.`;
  return { to, subject: title, text, html: brandWrapper(title, body) };
}
