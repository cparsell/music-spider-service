import { getUpcomingEvents } from "@/lib/eventsStore.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import { sendEventsWebhook } from "@/lib/webhookNotifier.js";

export async function POST() {
  const config = await getResolvedConfig();
  if (!config.webhookUrl) {
    return Response.json(
      { error: "No webhook URL configured in Settings" },
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
    await sendEventsWebhook({
      url: config.webhookUrl,
      template: config.webhookTemplate,
      events: upcoming,
      knownArtists,
      bold: config.webhookBoldFormat,
      bullet: config.webhookBulletFormat,
    });
    return Response.json({ sent: true, count: upcoming.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
