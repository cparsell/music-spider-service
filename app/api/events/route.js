import { getEvents, removeEvent } from "@/lib/eventsStore.js";

export async function GET() {
  return Response.json({ events: await getEvents() });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const events = await removeEvent(id);
  return Response.json({ events });
}
