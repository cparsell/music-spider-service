import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";
import { getResolvedConfig } from "./settings.js";

const TOKENS_FILE = "google-tokens.json";

export async function getStoredTokens() {
  return readJsonFile(TOKENS_FILE, null);
}

export async function saveTokens(tokens) {
  return withLock(TOKENS_FILE, async () => {
    await writeJsonFile(TOKENS_FILE, tokens);
    return tokens;
  });
}

export async function clearTokens() {
  return withLock(TOKENS_FILE, async () => {
    await writeJsonFile(TOKENS_FILE, null);
  });
}

async function refreshAccessToken(refreshToken) {
  const config = await getResolvedConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    access_token: data.access_token,
    // Google only returns a new refresh_token on the first authorization
    // (with prompt=consent); reuse the existing one on subsequent refreshes.
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Returns a valid Google access token, refreshing it first if it's expired
 * (or about to). Throws if the user has never connected their account.
 */
export async function getValidGoogleAccessToken() {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error(
      "Google is not connected. Go to Settings to connect your account.",
    );
  }

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  await saveTokens(refreshed);
  return refreshed.access_token;
}
