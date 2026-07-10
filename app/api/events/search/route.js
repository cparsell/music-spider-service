import { runEventSearch } from "@/lib/eventsSearch.js";

export async function POST() {
  const result = await runEventSearch();
  return Response.json(result);
}
