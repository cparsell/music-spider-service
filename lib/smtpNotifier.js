import nodemailer from "nodemailer";

/**
 * Sends an HTML email through a user-configured SMTP server - the plain-SMTP
 * alternative to the Gmail-based sending in gmail.js, for users who'd rather
 * use their own mail provider than connect a Google account.
 * @param {object} params {host, port, secure, user, password, from, to, subject, html}
 */
export async function sendSmtpEmail({
  host,
  port,
  secure,
  user,
  password,
  from,
  to,
  subject,
  html,
}) {
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: !!secure,
    auth: user ? { user, pass: password } : undefined,
    // nodemailer's defaults (2min connection, 30s greeting) make a failed
    // attempt feel hung - fail faster so the UI gives useful feedback.
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  await transporter.sendMail({ from: from || user, to, subject, html });
}
