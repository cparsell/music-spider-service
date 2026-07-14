import { buildEventsEmailSubject } from "./emailTemplate.js";
import {
  formatDateString,
  formatTimeAs12HourWithoutMinutes,
} from "./common.js";
import { formatActsList } from "./formatActs.js";

/**
 * Plain-text, one-line-per-event digest - the webhook analog of the HTML
 * email body, used to fill the {{summary}} placeholder in a user's webhook
 * template. Starts with a bolded "Music Spider Events Digest" title line
 * (same bold markup as the events below, so it's a no-op if left blank).
 * @param {array} events
 * @param {Set<string>} knownArtists
 * @param {string} [bold] wraps event/act names, e.g. "**" for Discord or "*"
 *   for Slack - left blank, no bold markup is added.
 * @param {string} [bullet] prefixes each event line - left blank, defaults
 *   to a literal bullet character.
 */
export function buildEventsSummaryText(
  events,
  knownArtists,
  bold = "",
  bullet = "",
) {
  const boldMark = bold || "";
  const bulletPrefix = bullet || "• ";
  const wrapBold = (text) => `${boldMark}${text}${boldMark}`;

  const title = wrapBold("Music Spider Events Digest");

  const lines = events
    .map((event) => {
      const acts = event.acts || [];
      const eNameLower = (event.eName || "").toLowerCase();
      const otherActs = acts.filter(
        (a) => !eNameLower.includes(a.toLowerCase()),
      );
      const actsLine = formatActsList(otherActs, knownArtists, 9, wrapBold);
      const withActs = actsLine ? ` with ${actsLine}` : "";

      const where = event.venue
        ? ` at ${event.venue}${event.city ? `, ${event.city}` : ""}`
        : "";

      const dateLine = (event.dates || [])
        .map((d) => {
          const dDate = new Date(d.date);
          return `${formatDateString(dDate)}`;
        })
        .join(", ");

      const eventName = wrapBold(event.eName || "Untitled event");

      return `${bulletPrefix}${eventName}${withActs}${where} — ${dateLine}`;
    })
    .join("\n");

  return `${title}\n\n${lines}`;
}

/**
 * Fills {{placeholder}} tokens in a user-authored JSON template with
 * events-digest values. Each substitution is JSON-escaped before insertion,
 * so it's safe to drop inside a quoted JSON string (e.g. `"content":
 * "{{summary}}"`) regardless of newlines/quotes in the underlying text.
 * Throws if the filled-in result isn't valid JSON, since that's almost
 * always a template mistake the user should hear about immediately.
 */
export function renderWebhookBody(
  template,
  events,
  knownArtists,
  bold,
  bullet,
) {
  const context = {
    subject: buildEventsEmailSubject(events, knownArtists),
    summary: buildEventsSummaryText(events, knownArtists, bold, bullet),
    count: String(events.length),
  };

  const body = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!(key in context)) return match;
    return JSON.stringify(context[key]).slice(1, -1);
  });

  try {
    JSON.parse(body);
  } catch (err) {
    throw new Error(
      `Webhook template did not render to valid JSON: ${err.message}`,
    );
  }

  return body;
}

/**
 * POSTs the rendered template to the configured webhook URL.
 * @param {object} params {url, template, events, knownArtists, bold, bullet}
 */
export async function sendEventsWebhook({
  url,
  template,
  events,
  knownArtists,
  bold,
  bullet,
}) {
  const body = renderWebhookBody(template, events, knownArtists, bold, bullet);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Webhook request failed: ${res.status}${text ? ` - ${text.slice(0, 300)}` : ""}`,
    );
  }
}
