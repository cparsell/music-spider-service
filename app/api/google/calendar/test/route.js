import { getResolvedConfig } from "@/lib/settings.js";
import { createCalendarEvent } from "@/lib/googleCalendar.js";

// Creates a trivial test event, independent of the real event search flow -
// lets a user confirm their OAuth connection or Apps Script webhook can
// actually write to the target calendar without waiting for a real search
// to find a new event.
export async function POST() {
  const config = await getResolvedConfig();

  try {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await createCalendarEvent({
      calendarId: config.calendarId,
      summary: "Music Spider test event",
      description: "This is a test event from Music Spider. Feel free to delete it.",
      start,
    });
    return Response.json({ created: true, id: created.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
