import { refreshAllTopArtistLists } from "@/lib/topArtistsRefresh.js";

export async function POST() {
  const { counts, errors } = await refreshAllTopArtistLists();
  return Response.json({ refreshed: true, counts, errors });
}
