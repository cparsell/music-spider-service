import { getSettings, updateSettings } from "./settings.js";
import { getEvents } from "./eventsStore.js";
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
    const events = await getEvents();
    const upcoming = events
      .filter((e) => new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length > 0) {
      await sendGmailMessage({
        to: settings.emailRecipient,
        subject: buildEventsEmailSubject(upcoming),
        html: buildEventsEmailHtml(upcoming),
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
