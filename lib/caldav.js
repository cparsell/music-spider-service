import { randomUUID } from "crypto";
import { getResolvedConfig } from "./settings.js";
import { normalizeBaseUrl } from "./common.js";

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Whether the user has turned CalDAV on and given us enough to connect
 * with. Doesn't validate that the URL/credentials actually work.
 */
export function isCalDavConfigured(config) {
  return !!(config.caldavEnabled && (config.caldavUrl || "").trim());
}

function authHeader(config) {
  if (!config.caldavUsername) return undefined;
  const token = Buffer.from(
    `${config.caldavUsername}:${config.caldavPassword || ""}`,
  ).toString("base64");
  return `Basic ${token}`;
}

// RFC 5545 TEXT escaping - backslash, then the characters it introduces,
// then real newlines to the literal "\n" escape sequence.
function escapeICalText(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatICalDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildVEvent({ uid, summary, description, location, start, end, url }) {
  const now = formatICalDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Music Spider//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICalDate(start)}`,
    `DTEND:${formatICalDate(end)}`,
    `SUMMARY:${escapeICalText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeICalText(description)}`);
  if (location) lines.push(`LOCATION:${escapeICalText(location)}`);
  if (url) lines.push(`URL:${escapeICalText(url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  // iCalendar requires CRLF line endings.
  return lines.join("\r\n");
}

/**
 * Confirms the calendar URL is reachable and the credentials work, without
 * creating anything - a PROPFIND (depth 0) is the standard WebDAV way to
 * check a collection exists and is accessible.
 * @returns {Promise<{url: string}>}
 */
export async function verifyCalDavAccess(config) {
  const resolved = config || (await getResolvedConfig());
  const url = normalizeBaseUrl(resolved.caldavUrl);
  if (!url) {
    throw new Error(
      "No CalDAV calendar URL is configured. Add one in Settings.",
    );
  }

  const auth = authHeader(resolved);
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      Depth: "0",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:displayname/></D:prop>
</D:propfind>`,
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `CalDAV server rejected the credentials (HTTP ${res.status}). Check the username/password.`,
    );
  }
  if (res.status === 404) {
    throw new Error(
      `CalDAV calendar not found at that URL (HTTP 404). Double-check the calendar's collection URL.`,
    );
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(`CalDAV server error: HTTP ${res.status}`);
  }

  return { url };
}

/**
 * Creates a calendar event on the configured CalDAV calendar via PUT, per
 * RFC 4791. Returns a fresh UID for every call - CalDAV has no equivalent
 * to Google's "insert and get back the server-assigned ID," so this app
 * generates the ID itself and uses it as both the event's UID and the
 * resource filename.
 * @param {object} params {summary, description, location, start, url}
 * @returns {object} {id} the UID used for the created event
 */
export async function createCalDavEvent({
  summary,
  description,
  location,
  start,
  url,
}) {
  const config = await getResolvedConfig();
  const base = calendarUrl(config);
  if (!base) {
    throw new Error(
      "No CalDAV calendar URL is configured. Add one in Settings.",
    );
  }

  const uid = randomUUID();
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MS);
  const ics = buildVEvent({
    uid,
    summary,
    description,
    location,
    start: startDate,
    end: endDate,
    url,
  });

  const auth = authHeader(config);
  const res = await fetch(`${base}/${uid}.ics`, {
    method: "PUT",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    },
    body: ics,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `CalDAV server rejected the event: HTTP ${res.status}${text ? ` - ${text.slice(0, 300)}` : ""}`,
    );
  }

  return { id: uid };
}
