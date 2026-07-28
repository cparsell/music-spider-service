import { getSettings, updateSettings } from "./settings.js";
import { getUpcomingEvents } from "./eventsStore.js";
import { getCombinedArtistList } from "./combinedArtistList.js";
import {
  buildEventsEmailHtml,
  buildEventsEmailSubject,
} from "./emailTemplate.js";
import { sendSmtpEmail } from "./smtpNotifier.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sends the weekly events-digest email via SMTP if it's enabled, a host and
 * recipient are configured, and at least a week has passed since the last
 * send. Called periodically from instrumentation.js.
 */
export async function checkAndSendWeeklySmtpEmail() {
  const settings = await getSettings();
  if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpRecipient)
    return;

  const last = settings.lastWeeklySmtpEmailSentAt
    ? new Date(settings.lastWeeklySmtpEmailSentAt).getTime()
    : 0;
  if (Date.now() - last < WEEK_MS) return;

  try {
    const upcoming = await getUpcomingEvents();

    if (upcoming.length > 0) {
      const knownArtists = new Set(await getCombinedArtistList());
      await sendSmtpEmail({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        user: settings.smtpUser,
        password: settings.smtpPassword,
        from: settings.smtpFrom,
        to: settings.smtpRecipient,
        subject: buildEventsEmailSubject(upcoming, knownArtists),
        html: buildEventsEmailHtml(upcoming, knownArtists),
      });
      console.info(
        `Weekly SMTP email sent to ${settings.smtpRecipient} (${upcoming.length} events)`,
      );
    } else {
      console.info(
        "Weekly SMTP email check: no upcoming events, skipping send",
      );
    }
  } catch (err) {
    console.error("checkAndSendWeeklySmtpEmail() error:", err.message);
  } finally {
    // Always advance the timestamp, even on failure or when there's
    // nothing to send, so a persistent error doesn't retry every check.
    await updateSettings({
      lastWeeklySmtpEmailSentAt: new Date().toISOString(),
    });
  }
}
