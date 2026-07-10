import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS = {
  theme: "grayscale", // "grayscale" | "catppuccin-mocha"
  maxTopArtistsCount: 250,
  combinedTopArtistsMode: "weighted",
  artistSource: "tautulli", // "tautulli" | "spotify" | "both"
  eventSearchTerms: ["short_term", "medium_term", "long_term"],
  eventSearchSources: ["ticketmaster", "resadvisor"],
  topArtistsAutoRefreshEnabled: false,
  topArtistsAutoRefreshDays: 1,
  lastTopArtistsRefreshAt: "",
  eventSearchAutoRefreshEnabled: false,
  eventSearchAutoRefreshDays: 7,
  lastEventSearchAt: "",

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

  emailRecipient: "",
  calendarId: "",

  googleIntegrationMode: "oauth", // "oauth" | "appsScript"
  googleClientId: "",
  googleClientSecret: "",
  googleRedirectUri: "",
  appsScriptWebhookUrl: "",
  appsScriptSharedSecret: "",
  weeklyEmailEnabled: false,
  weeklyEmailDayOfWeek: 1, // 0 = Sunday ... 6 = Saturday
  weeklyEmailTimeOfDay: "09:00",
  lastWeeklyEmailSentAt: "",
  googleCalendarSyncEnabled: false,

  webhookEnabled: false,
  webhookUrl: "",
  webhookTemplate: '{\n  "content": "{{summary}}"\n}',
  lastWeeklyWebhookSentAt: "",
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
  emailRecipient: "EMAIL_RECIPIENT",
  calendarId: "CALENDAR_ID",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
  googleRedirectUri: "GOOGLE_REDIRECT_URI",
  appsScriptWebhookUrl: "APPS_SCRIPT_WEBHOOK_URL",
  appsScriptSharedSecret: "APPS_SCRIPT_SHARED_SECRET",
  webhookUrl: "WEBHOOK_URL",
};

// Lowest-priority fallback, used only when neither a saved setting nor an
// env var provides a value - i.e. sane defaults for a brand new setup.
// A function (not a static object) since the redirect URIs depend on
// whatever port the app is actually running on.
function getHardcodedDefaults() {
  const port = process.env.PORT || 6100;
  return {
    radius: "30",
    units: "miles",
    spotifyRedirectUri: `http://127.0.0.1:${port}/api/spotify/callback`,
    googleRedirectUri: `http://127.0.0.1:${port}/api/google/callback`,
  };
}

export async function getSettings() {
  const stored = await readJsonFile(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch) {
  return withLock(SETTINGS_FILE, async () => {
    const current = await readJsonFile(SETTINGS_FILE, {});
    const updated = { ...DEFAULT_SETTINGS, ...current, ...patch };

    // Starting the weekly-email clock from the moment it's turned on, so
    // enabling it doesn't immediately fire an email.
    if (patch.weeklyEmailEnabled && !current.weeklyEmailEnabled) {
      updated.lastWeeklyEmailSentAt = new Date().toISOString();
    }

    // Same idea for top-artists auto-refresh: don't immediately refresh
    // just because the setting was turned on.
    if (
      patch.topArtistsAutoRefreshEnabled &&
      !current.topArtistsAutoRefreshEnabled
    ) {
      updated.lastTopArtistsRefreshAt = new Date().toISOString();
    }

    // Same idea for the weekly webhook.
    if (patch.webhookEnabled && !current.webhookEnabled) {
      updated.lastWeeklyWebhookSentAt = new Date().toISOString();
    }

    // Same idea for events auto-search: don't immediately search just
    // because the setting was turned on.
    if (
      patch.eventSearchAutoRefreshEnabled &&
      !current.eventSearchAutoRefreshEnabled
    ) {
      updated.lastEventSearchAt = new Date().toISOString();
    }

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
  for (const [key, value] of Object.entries(getHardcodedDefaults())) {
    if (!resolved[key]) resolved[key] = value;
  }
  return resolved;
}
