import { getEvents } from "@/lib/eventsStore.js";
import { getResolvedConfig } from "@/lib/settings.js";
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

  const events = await getEvents();
  const upcoming = events
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (upcoming.length === 0) {
    return Response.json(
      { error: "No upcoming events to email" },
      { status: 400 },
    );
  }

  try {
    await sendGmailMessage({
      to: config.emailRecipient,
      subject: buildEventsEmailSubject(upcoming),
      html: buildEventsEmailHtml(upcoming),
    });
    return Response.json({ sent: true, count: upcoming.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
