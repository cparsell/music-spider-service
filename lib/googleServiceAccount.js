/**
 * Google Calendar access through a GCP service account instead of a user
 * OAuth connection - see Setup-GoogleCalendarAccess.md. The user shares a
 * calendar with the service account's email address, and this app signs a
 * JWT with the account's private key to get an access token. No consent
 * screen, redirect URI, or HTTPS needed, unlike the OAuth flow.
 *
 * Service accounts can't send Gmail without domain-wide delegation, so this
 * covers calendar events only - email still goes through OAuth/SMTP.
 */

import { createSign } from "crypto";
import { promises as fs } from "fs";
import { getResolvedConfig } from "./settings.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Enough to create and list events on calendars shared with the account -
// no access to calendars that haven't been shared with it.
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const ASSERTION_LIFETIME_SEC = 3600; // Google's maximum

// client_email -> { accessToken, expiresAt } so every event in a sync run
// doesn't re-sign a JWT and round-trip to Google's token endpoint.
const tokenCache = new Map();

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

/**
 * Whether the user has turned on service account mode and given us
 * something to authenticate with. Doesn't validate the key itself.
 */
export function isServiceAccountEnabled(config) {
  return !!(
    config.googleServiceAccountEnabled &&
    (config.googleServiceAccountJson || "").trim()
  );
}

/**
 * The service account key, from either the JSON pasted into Settings or a
 * path to the key file Google downloaded (easier to mount into a container
 * than to paste a private key into a text field).
 * @returns {Promise<object>} the parsed key, with a usable `private_key`
 */
export async function loadServiceAccountKey(config) {
  const raw = (config.googleServiceAccountJson || "").trim();
  if (!raw) {
    throw new Error(
      "No Google service account key is configured. Add one in Settings.",
    );
  }

  let text = raw;
  if (!raw.startsWith("{")) {
    try {
      text = await fs.readFile(raw, "utf8");
    } catch (err) {
      throw new Error(
        `Couldn't read the service account key file at "${raw}": ${err.message}`,
      );
    }
  }

  let key;
  try {
    key = JSON.parse(text);
  } catch {
    throw new Error(
      "The service account key isn't valid JSON. Paste the whole file Google downloaded, or the path to it.",
    );
  }

  if (!key.client_email || !key.private_key) {
    throw new Error(
      "The service account key is missing client_email / private_key. Use the JSON key file, not the OAuth client secret file.",
    );
  }

  return {
    ...key,
    // A key passed through an env var usually arrives with literal "\n"
    // sequences rather than real newlines, which the signer won't accept.
    private_key: key.private_key.replace(/\\n/g, "\n"),
  };
}

async function requestAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const signingInput = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: now,
        exp: now + ASSERTION_LIFETIME_SEC,
      }),
    ),
  ].join(".");

  let signature;
  try {
    signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(key.private_key, "base64url");
  } catch (err) {
    throw new Error(
      `Couldn't sign with the service account's private key: ${err.message}`,
    );
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signature}`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error_description || data.error || res.status;
    throw new Error(`Google rejected the service account key: ${detail}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * A valid access token for the configured service account, minted (and
 * cached until shortly before it expires) on demand.
 */
export async function getServiceAccountAccessToken(config) {
  const resolved = config || (await getResolvedConfig());
  const key = await loadServiceAccountKey(resolved);

  const cached = tokenCache.get(key.client_email);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.accessToken;
  }

  const fresh = await requestAccessToken(key);
  tokenCache.set(key.client_email, fresh);
  return fresh.accessToken;
}

/**
 * Which calendar service account mode writes to. Unlike the OAuth flow,
 * "primary" here is the service account's own hidden calendar rather than
 * the user's, so an explicit ID is required.
 * @param {string} [override] a calendar ID passed by the caller
 */
export function resolveServiceAccountCalendarId(config, override) {
  const calendarId = (
    config.googleServiceAccountCalendarId ||
    override ||
    config.calendarId ||
    ""
  ).trim();

  if (!calendarId || calendarId === "primary") {
    throw new Error(
      "Service account mode needs an explicit Calendar ID - the one you shared with the service account (for your main calendar, that's your Gmail address). A blank/primary calendar would write to the service account's own calendar, which you can't see.",
    );
  }
  return calendarId;
}

/**
 * Confirms the key works and the target calendar has actually been shared
 * with the service account, without creating anything.
 * @returns {Promise<{clientEmail: string, calendarId: string}>}
 */
export async function verifyCalendarAccess(config) {
  const resolved = config || (await getResolvedConfig());
  const key = await loadServiceAccountKey(resolved);
  const calendarId = resolveServiceAccountCalendarId(resolved);
  const accessToken = await getServiceAccountAccessToken(resolved);

  const params = new URLSearchParams({
    maxResults: "1",
    timeMin: new Date().toISOString(),
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 404) {
      throw new Error(
        `Calendar "${calendarId}" isn't visible to ${key.client_email}. Share that calendar with the service account ("Make changes to events"), and double-check the Calendar ID.`,
      );
    }
    if (res.status === 403) {
      throw new Error(
        `${message} - make sure the Google Calendar API is enabled in the service account's GCP project and the calendar is shared with ${key.client_email}.`,
      );
    }
    throw new Error(`Google Calendar API error: ${message}`);
  }

  return { clientEmail: key.client_email, calendarId };
}
