import {
  attachIsNew,
  getEvents,
  setDateCalendarEventId,
  setDateCalDavEventId,
} from "@/lib/eventsStore.js";
import { attachActsDisplay } from "@/lib/formatActs.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { createCalendarEvent, isGoogleCalendarAvailable } from "@/lib/googleCalendar.js";
import { isCalDavConfigured, createCalDavEvent } from "@/lib/caldav.js";

export async function POST(req, { params }) {
  const { id } = await params;
  try {
    const { date } = await req.json();
    const event = (await getEvents()).find((e) => e.id === id);
    const dateEntry = event?.dates.find((d) => d.date === date);
    if (!dateEntry) {
      return Response.json({ error: "Event date not found" }, { status: 400 });
    }

    const config = await getResolvedConfig();
    const [googleAvailable, caldavAvailable] = await Promise.all([
      isGoogleCalendarAvailable(config),
      isCalDavConfigured(config),
    ]);

    if (!googleAvailable && !caldavAvailable) {
      return Response.json(
        {
          error:
            "No calendar connected. Set up Google Calendar or CalDAV in Settings.",
        },
        { status: 400 },
      );
    }

    // Attempts whichever of Google/CalDAV is available and not already
    // synced for this date - so re-clicking after enabling a second
    // calendar target backfills just that one, rather than erroring out or
    // re-adding a duplicate to the one already synced.
    const added = [];
    const errors = [];

    if (googleAvailable && !dateEntry.calendarEventId) {
      try {
        const created = await createCalendarEvent({
          calendarId: config.calendarId,
          summary: event.eName,
          description: (event.acts || []).join(", "),
          location: event.address || event.venue,
          start: date,
          url: dateEntry.urls?.[0]?.url,
        });
        await setDateCalendarEventId(id, date, created.id);
        added.push("Google Calendar");
      } catch (err) {
        errors.push(`Google Calendar: ${err.message}`);
      }
    }

    if (caldavAvailable && !dateEntry.caldavEventId) {
      try {
        const created = await createCalDavEvent({
          summary: event.eName,
          description: (event.acts || []).join(", "),
          location: event.address || event.venue,
          start: date,
          url: dateEntry.urls?.[0]?.url,
        });
        await setDateCalDavEventId(id, date, created.id);
        added.push("CalDAV");
      } catch (err) {
        errors.push(`CalDAV: ${err.message}`);
      }
    }

    const events = attachIsNew(await attachActsDisplay(await getEvents()));

    if (added.length === 0 && errors.length > 0) {
      return Response.json({ error: errors.join(" | "), events }, { status: 500 });
    }

    return Response.json({
      events,
      addedTo: added,
      warning: errors.length > 0 ? errors.join(" | ") : undefined,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
