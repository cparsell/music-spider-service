import { getSettings, updateSettings } from "./settings.js";
import { runEventSearch } from "./eventsSearch.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs an event search if auto-search is enabled and enough days have
 * passed since the last run. Called periodically from instrumentation.js.
 */
export async function checkAndRunEventSearch() {
  const settings = await getSettings();
  if (!settings.eventSearchAutoRefreshEnabled) return;

  const days = Number(settings.eventSearchAutoRefreshDays) || 7;
  const last = settings.lastEventSearchAt
    ? new Date(settings.lastEventSearchAt).getTime()
    : 0;
  if (Date.now() - last < days * DAY_MS) return;

  try {
    await runEventSearch();
    console.info("Events auto-search complete");
  } catch (err) {
    console.error("checkAndRunEventSearch() error:", err.message);
  } finally {
    // Always advance the timestamp, even on failure, so a persistent error
    // doesn't retry every check interval indefinitely.
    await updateSettings({ lastEventSearchAt: new Date().toISOString() });
  }
}
