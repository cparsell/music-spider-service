import { getValidGoogleAccessToken, hasCalendarScope } from "./googleTokens.js";
import { getResolvedConfig } from "./settings.js";
import {
  isServiceAccountEnabled,
  getServiceAccountAccessToken,
  resolveServiceAccountCalendarId,
} from "./googleServiceAccount.js";

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Whether Google Calendar is currently usable for creating events - either
 * a service account is enabled, or the connected OAuth token has calendar
 * scope. Shared by the connection-status check and anywhere that needs to
 * know before attempting to create an event.
 */
export async function isGoogleCalendarAvailable(config) {
  const resolved = config || (await getResolvedConfig());
  if (isServiceAccountEnabled(resolved)) return true;
  return hasCalendarScope();
}

/**
 * POSTs an event to the Calendar API with whichever access token the
 * caller authenticated with (a user's OAuth token or a service account's).
 */
async function insertCalendarEvent({ accessToken, calendarId, event }) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
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

/**
 * Creates a Google Calendar event - via a GCP service account, or via the
 * Calendar API using the connected OAuth account. Service account mode
 * wins when it's enabled.
 * @param {object} params
 * @param {string} [params.calendarId] defaults to the account's primary
 *   calendar in OAuth mode; service account mode requires an explicit ID and
 *   prefers the one configured for the service account
 * @param {string} params.summary
 * @param {string} [params.description]
 * @param {string} [params.location]
 * @param {Date|string} params.start
 * @param {string} [params.url] ticket link, added as the event's source link
 * @returns {object} the created event - at least `{id}`, plus the full
 *   Calendar API event object in OAuth/service account mode
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
  const serviceAccount = isServiceAccountEnabled(config);

  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MS);
  const event = {
    summary,
    description,
    location,
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    ...(url ? { source: { title: "Tickets", url } } : {}),
  };

  if (serviceAccount) {
    return insertCalendarEvent({
      accessToken: await getServiceAccountAccessToken(config),
      calendarId: resolveServiceAccountCalendarId(config, calendarId),
      event,
    });
  }

  return insertCalendarEvent({
    accessToken: await getValidGoogleAccessToken(),
    calendarId: calendarId || "primary",
    event,
  });
}
