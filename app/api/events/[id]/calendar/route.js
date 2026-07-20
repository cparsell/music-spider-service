import { getEvents, setDateCalendarEventId } from "@/lib/eventsStore.js";
import { attachActsDisplay } from "@/lib/formatActs.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { createCalendarEvent } from "@/lib/googleCalendar.js";

export async function POST(req, { params }) {
  const { id } = await params;
  try {
    const { date } = await req.json();
    // get the event specific to the id and date, and check if it already has a calendarEventId
    const event = (await getEvents()).find((e) => e.id === id);
    const dateEntry = event?.dates.find((d) => d.date === date);
    if (!dateEntry) {
      return Response.json({ error: "Event date not found" }, { status: 400 });
    }
    if (dateEntry.calendarEventId) {
      return Response.json(
        { error: "Already added to Calendar" },
        { status: 400 },
      );
    }

    const config = await getResolvedConfig();
    const created = await createCalendarEvent({
      calendarId: config.calendarId,
      summary: event.eName,
      description: (event.acts || []).join(", "),
      location: event.address || event.venue,
      start: date,
      url: dateEntry.urls?.[0]?.url,
    });
    const events = await setDateCalendarEventId(id, date, created.id);
    return Response.json({ events: await attachActsDisplay(events) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
