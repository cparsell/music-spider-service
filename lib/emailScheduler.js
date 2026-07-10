import { getSettings, updateSettings } from "./settings.js";
import { getUpcomingEvents } from "./eventsStore.js";
import { getCombinedArtistList } from "./combinedArtistList.js";
import {
  buildEventsEmailHtml,
  buildEventsEmailSubject,
} from "./emailTemplate.js";
import { sendGmailMessage } from "./gmail.js";

// Finds the most recent moment matching `dayOfWeek`/`timeOfDay` at or before
// `now` - i.e. this week's scheduled send time, or last week's if this
// week's hasn't happened yet.
function mostRecentOccurrence(dayOfWeek, timeOfDay, now = new Date()) {
  const [hours, minutes] = (timeOfDay || "09:00").split(":").map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  const dayDiff = (now.getDay() - dayOfWeek + 7) % 7;
  target.setDate(target.getDate() - dayDiff);
  if (target > now) target.setDate(target.getDate() - 7);
  return target;
}

/**
 * Sends the weekly events digest if it's enabled, a recipient is
 * configured, and this week's scheduled day/time (`weeklyEmailDayOfWeek`/
 * `weeklyEmailTimeOfDay`) has been reached since the last send. Called
 * periodically from instrumentation.js.
 */
export async function checkAndSendWeeklyEmail() {
  const settings = await getSettings();
  if (!settings.weeklyEmailEnabled || !settings.emailRecipient) return;

  const scheduledAt = mostRecentOccurrence(
    settings.weeklyEmailDayOfWeek,
    settings.weeklyEmailTimeOfDay,
  );
  const last = settings.lastWeeklyEmailSentAt
    ? new Date(settings.lastWeeklyEmailSentAt)
    : new Date(0);
  if (last >= scheduledAt) return;

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
