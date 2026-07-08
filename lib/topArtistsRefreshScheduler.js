import { getSettings, updateSettings } from "./settings.js";
import { refreshAllTopArtistLists } from "./topArtistsRefresh.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refreshes all top-artists lists if auto-refresh is enabled and enough
 * days have passed since the last refresh. Called periodically from
 * instrumentation.js.
 */
export async function checkAndRefreshTopArtists() {
  const settings = await getSettings();
  if (!settings.topArtistsAutoRefreshEnabled) return;

  const days = Number(settings.topArtistsAutoRefreshDays) || 1;
  const last = settings.lastTopArtistsRefreshAt
    ? new Date(settings.lastTopArtistsRefreshAt).getTime()
    : 0;
  if (Date.now() - last < days * DAY_MS) return;

  try {
    const { errors } = await refreshAllTopArtistLists();
    if (errors) {
      console.error("checkAndRefreshTopArtists() errors:", errors);
    } else {
      console.info("Top artists lists auto-refreshed");
    }
  } catch (err) {
    console.error("checkAndRefreshTopArtists() error:", err.message);
  } finally {
    // Always advance the timestamp, even on failure, so a persistent error
    // doesn't retry every check interval indefinitely.
    await updateSettings({ lastTopArtistsRefreshAt: new Date().toISOString() });
  }
}
