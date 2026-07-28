import { getUpcomingEvents } from "@/lib/eventsStore.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import {
  buildEventsEmailHtml,
  buildEventsEmailSubject,
} from "@/lib/emailTemplate.js";
import { sendSmtpEmail } from "@/lib/smtpNotifier.js";

export async function POST() {
  const config = await getResolvedConfig();
  if (!config.smtpHost || !config.smtpRecipient) {
    return Response.json(
      { error: "SMTP host and recipient must be configured in Settings" },
      { status: 400 },
    );
  }

  const upcoming = await getUpcomingEvents();

  if (upcoming.length === 0) {
    return Response.json(
      { error: "No upcoming events to send" },
      { status: 400 },
    );
  }

  try {
    const knownArtists = new Set(await getCombinedArtistList());
    await sendSmtpEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      user: config.smtpUser,
      password: config.smtpPassword,
      from: config.smtpFrom,
      to: config.smtpRecipient,
      subject: buildEventsEmailSubject(upcoming, knownArtists),
      html: buildEventsEmailHtml(upcoming, knownArtists),
    });
    return Response.json({ sent: true, count: upcoming.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
