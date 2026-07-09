import { getValidGoogleAccessToken } from "./googleTokens.js";
import { getResolvedConfig } from "./settings.js";
import { createAppsScriptCalendarEvent } from "./appsScriptNotifier.js";

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Creates a Google Calendar event - via the Calendar API using the
 * connected OAuth account, or via a user-deployed Apps Script webapp,
 * depending on googleIntegrationMode in Settings.
 * @param {object} params
 * @param {string} [params.calendarId] defaults to the account's primary calendar
 * @param {string} params.summary
 * @param {string} [params.description]
 * @param {string} [params.location]
 * @param {Date|string} params.start
 * @param {string} [params.url] ticket link, added as the event's source link
 * @returns {object} the created event - at least `{id}`, plus the full
 *   Calendar API event object in OAuth mode
 */
export async function createCalendarEvent({
  calendarId,
  summary,
  description,
  location,
  start,
  url,
}) {
  const config = await getResolvedConfig();
  if (config.googleIntegrationMode === "appsScript") {
    return createAppsScriptCalendarEvent({
      webhookUrl: config.appsScriptWebhookUrl,
      secret: config.appsScriptSharedSecret,
      calendarId,
      summary,
      description,
      location,
      start,
      url,
    });
  }

  const accessToken = await getValidGoogleAccessToken();
  const cal = calendarId || "primary";
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MS);

  const body = {
    summary,
    description,
    location,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    ...(url ? { source: { title: "Tickets", url } } : {}),
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message || text;
    } catch {
      // not JSON - use the raw text as-is
    }
    throw new Error(`Google Calendar API error: ${message} (${res.status})`);
  }

  return res.json();
}
