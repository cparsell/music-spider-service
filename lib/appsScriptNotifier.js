/**
 * Sends events-related actions (email, calendar) through a user-deployed
 * Google Apps Script webapp instead of Google's OAuth APIs directly - see
 * apps-script/Code.gs. Avoids needing an OAuth client, redirect URI, or
 * HTTPS on this app's own end, at the cost of the user maintaining a small
 * script of their own.
 */

async function callAppsScript(webhookUrl, secret, body) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, secret }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Apps Script webhook returned a non-JSON response (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Apps Script webhook request failed: ${res.status}`);
  }

  return data;
}

/**
 * @param {object} params {webhookUrl, secret, to, subject, html}
 */
export async function sendAppsScriptEmail({ webhookUrl, secret, to, subject, html }) {
  if (!webhookUrl) {
    throw new Error("Apps Script webhook URL is not configured in Settings");
  }
  await callAppsScript(webhookUrl, secret, { type: "email", to, subject, html });
}

/**
 * @param {object} params {webhookUrl, secret, calendarId, summary, description, location, start, url}
 * @returns {object} {id} the created event's Google Calendar event ID
 */
export async function createAppsScriptCalendarEvent({
  webhookUrl,
  secret,
  calendarId,
  summary,
  description,
  location,
  start,
  url,
}) {
  if (!webhookUrl) {
    throw new Error("Apps Script webhook URL is not configured in Settings");
  }
  const data = await callAppsScript(webhookUrl, secret, {
    type: "calendar",
    calendarId,
    summary,
    description,
    location,
    start: new Date(start).toISOString(),
    url,
  });
  return { id: data.id };
}
