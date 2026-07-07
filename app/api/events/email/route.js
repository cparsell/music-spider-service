import { getUpcomingEvents } from "@/lib/eventsStore.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import {
  buildEventsEmailHtml,
  buildEventsEmailSubject,
} from "@/lib/emailTemplate.js";
import { sendGmailMessage } from "@/lib/gmail.js";

export async function POST() {
  const config = await getResolvedConfig();
  if (!config.emailRecipient) {
    return Response.json(
      { error: "No email recipient configured in Settings" },
      { status: 400 },
    );
  }

  const upcoming = await getUpcomingEvents();

  if (upcoming.length === 0) {
    return Response.json(
      { error: "No upcoming events to email" },
      { status: 400 },
    );
  }

  try {
    const knownArtists = new Set(await getCombinedArtistList());
    await sendGmailMessage({
      to: config.emailRecipient,
      subject: buildEventsEmailSubject(upcoming, knownArtists),
      html: buildEventsEmailHtml(upcoming, knownArtists),
    });
    return Response.json({ sent: true, count: upcoming.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
