import { createCalDavEvent } from "@/lib/caldav.js";

// Creates a test event that lets a user confirm their CalDAV connection can
// write to the target calendar.
export async function POST() {
  try {
    const start = new Date(Date.now());
    const created = await createCalDavEvent({
      summary: "Music Spider test event",
      description: "This is a test event from Music Spider. Feel free to delete it.",
      start,
    });
    return Response.json({ created: true, id: created.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
