import { runEventSearch } from "@/lib/eventsSearch.js";

export async function POST() {
  try {
    const result = await runEventSearch();
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
