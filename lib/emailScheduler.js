import { getSettings, updateSettings } from "./settings.js";
import { getUpcomingEvents } from "./eventsStore.js";
import { getCombinedArtistList } from "./combinedArtistList.js";
import {
  buildEventsEmailHtml,
  buildEventsEmailSubject,
} from "./emailTemplate.js";
import { sendGmailMessage } from "./gmail.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sends the weekly events digest if it's enabled, a recipient is
 * configured, and at least a week has passed since the last send. Called
 * periodically from instrumentation.js.
 */
export async function checkAndSendWeeklyEmail() {
  const settings = await getSettings();
  if (!settings.weeklyEmailEnabled || !settings.emailRecipient) return;

  const last = settings.lastWeeklyEmailSentAt
    ? new Date(settings.lastWeeklyEmailSentAt).getTime()
    : 0;
  if (Date.now() - last < WEEK_MS) return;

  try {
    const upcoming = await getUpcomingEvents();

    if (upcoming.length > 0) {
      const knownArtists = new Set(await getCombinedArtistList());
      await sendGmailMessage({
        to: settings.emailRecipient,
        subject: buildEventsEmailSubject(upcoming, knownArtists),
        html: buildEventsEmailHtml(upcoming, knownArtists),
      });
      console.info(
        `Weekly email sent to ${settings.emailRecipient} (${upcoming.length} events)`,
      );
    } else {
      console.info("Weekly email check: no upcoming events, skipping send");
    }
  } catch (err) {
    console.error("checkAndSendWeeklyEmail() error:", err.message);
  } finally {
    // Always advance the timestamp, even on failure or when there's
    // nothing to send, so a persistent error doesn't retry every check.
    await updateSettings({ lastWeeklyEmailSentAt: new Date().toISOString() });
  }
}
