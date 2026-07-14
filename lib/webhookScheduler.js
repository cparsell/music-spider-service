import { getSettings, updateSettings } from "./settings.js";
import { getUpcomingEvents } from "./eventsStore.js";
import { getCombinedArtistList } from "./combinedArtistList.js";
import { sendEventsWebhook } from "./webhookNotifier.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sends the weekly events-digest webhook if it's enabled, a URL is
 * configured, and at least a week has passed since the last send. Called
 * periodically from instrumentation.js.
 */
export async function checkAndSendWeeklyWebhook() {
  const settings = await getSettings();
  if (!settings.webhookEnabled || !settings.webhookUrl) return;

  const last = settings.lastWeeklyWebhookSentAt
    ? new Date(settings.lastWeeklyWebhookSentAt).getTime()
    : 0;
  if (Date.now() - last < WEEK_MS) return;

  try {
    const upcoming = await getUpcomingEvents();

    if (upcoming.length > 0) {
      const knownArtists = new Set(await getCombinedArtistList());
      await sendEventsWebhook({
        url: settings.webhookUrl,
        template: settings.webhookTemplate,
        events: upcoming,
        knownArtists,
        bold: settings.webhookBoldFormat,
        bullet: settings.webhookBulletFormat,
      });
      console.info(
        `Weekly webhook sent to ${settings.webhookUrl} (${upcoming.length} events)`,
      );
    } else {
      console.info("Weekly webhook check: no upcoming events, skipping send");
    }
  } catch (err) {
    console.error("checkAndSendWeeklyWebhook() error:", err.message);
  } finally {
    // Always advance the timestamp, even on failure or when there's
    // nothing to send, so a persistent error doesn't retry every check.
    await updateSettings({ lastWeeklyWebhookSentAt: new Date().toISOString() });
  }
}
