import { getEvents, removeEvent } from "@/lib/eventsStore.js";
import { attachActsDisplay } from "@/lib/formatActs.js";

export async function GET() {
  return Response.json({ events: await attachActsDisplay(await getEvents()) });
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    const events = await removeEvent(id);
    return Response.json({ events: await attachActsDisplay(events) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
