import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS = {
  maxTopArtistsCount: 250,
  combinedTopArtistsMode: "weighted",
  artistSource: "tautulli", // "tautulli" | "spotify" | "both"
  eventSearchTerms: ["short_term", "medium_term", "long_term"],

  tautulliUrl: "",
  tautulliApiKey: "",
  tautulliMusicSectionId: "",

  spotifyClientId: "",
  spotifyClientSecret: "",
  spotifyRedirectUri: "",

  ticketmasterApiKey: "",
  latLong: "",
  radius: "",
  units: "",

  raRegion: "",

  nextAuthSecret: "",
  nextAuthUrl: "",

  emailRecipient: "",
  calendarId: "",
};

// Settings a user has explicitly saved, falling back to these env vars when
// a field is blank - lets the app keep working from .env.local until
// someone overrides a value from the Settings tab.
const ENV_FALLBACKS = {
  tautulliUrl: "TAUTULLI_URL",
  tautulliApiKey: "TAUTULLI_API_KEY",
  tautulliMusicSectionId: "TAUTULLI_MUSIC_SECTION_ID",
  spotifyClientId: "SPOTIFY_CLIENT_ID",
  spotifyClientSecret: "SPOTIFY_CLIENT_SECRET",
  spotifyRedirectUri: "SPOTIFY_REDIRECT_URI",
  ticketmasterApiKey: "TICKETMASTER_API_KEY",
  latLong: "LAT_LONG",
  radius: "RADIUS",
  units: "UNITS",
  raRegion: "RA_REGION",
  nextAuthSecret: "NEXTAUTH_SECRET",
  nextAuthUrl: "NEXTAUTH_URL",
  emailRecipient: "EMAIL_RECIPIENT",
  calendarId: "CALENDAR_ID",
};

// Lowest-priority fallback, used only when neither a saved setting nor an
// env var provides a value - i.e. sane defaults for a brand new setup.
const HARDCODED_DEFAULTS = {
  radius: "30",
  units: "miles",
};

export async function getSettings() {
  const stored = await readJsonFile(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch) {
  return withLock(SETTINGS_FILE, async () => {
    const current = await readJsonFile(SETTINGS_FILE, {});
    const updated = { ...DEFAULT_SETTINGS, ...current, ...patch };
    await writeJsonFile(SETTINGS_FILE, updated);
    return updated;
  });
}

/**
 * Settings merged with env var fallbacks for anything left blank. This is
 * what the rest of the app (Tautulli/Ticketmaster/RA calls) should read from
 * so a saved setting always takes precedence over .env.local.
 */
export async function getResolvedConfig() {
  const settings = await getSettings();
  const resolved = { ...settings };
  for (const [key, envVar] of Object.entries(ENV_FALLBACKS)) {
    if (!resolved[key]) resolved[key] = process.env[envVar] || "";
  }
  for (const [key, value] of Object.entries(HARDCODED_DEFAULTS)) {
    if (!resolved[key]) resolved[key] = value;
  }
  return resolved;
}
