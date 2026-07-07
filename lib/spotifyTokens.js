import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";
import { getResolvedConfig } from "./settings.js";

const TOKENS_FILE = "spotify-tokens.json";

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
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${config.spotifyClientId}:${config.spotifyClientSecret}`,
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Returns a valid Spotify access token, refreshing it first if it's expired
 * (or about to). Throws if the user has never connected their account.
 */
export async function getValidSpotifyAccessToken() {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error(
      "Spotify is not connected. Go to Settings to connect your account.",
    );
  }

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  await saveTokens(refreshed);
  return refreshed.access_token;
}
