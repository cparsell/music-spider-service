import { getEvents, removeEvent } from "@/lib/eventsStore.js";
import { ignoredEvents } from "@/lib/ignoredEvents.js";
import { attachActsDisplay } from "@/lib/formatActs.js";

export async function GET() {
  return Response.json({ events: await attachActsDisplay(await getEvents()) });
}

export async function DELETE(req) {
  try {
    const { id, ignore } = await req.json();
    if (ignore) {
      const event = (await getEvents()).find((e) => e.id === id);
      if (event) {
        await ignoredEvents.addDates(
          event,
          (event.dates || []).map((d) => d.date),
        );
      }
    }
    const events = await removeEvent(id);
    return Response.json({ events: await attachActsDisplay(events) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
