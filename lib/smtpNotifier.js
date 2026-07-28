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

  try {
    await transporter.sendMail({ from: from || user, to, subject, html });
  } catch (err) {
    // A TLS/port mismatch surfaces as a raw OpenSSL error that says nothing
    // about the actual cause, so name it - it's the most common misconfig.
    if (/wrong version number/i.test(err.message || "")) {
      throw new Error(
        `TLS mismatch: ${host}:${port} doesn't accept implicit TLS. Use port 465 with Implicit TLS (SSL), or port 587 with STARTTLS.`,
      );
    }
    throw err;
  }
}
