import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import { searchRA } from "../resadvisor/route.js";
import { searchTMLoop } from "../ticketmaster/route.js";
import { upsertEvent, getEvents } from "@/lib/eventsStore.js";

export async function POST() {
  const artistList = await getCombinedArtistList();

  const [
    raEvents,
    // tmEvents
  ] = await Promise.all([
    searchRA(artistList),
    // searchTMLoop(artistList),
  ]);

  for (const event of [
    ...raEvents,
    // ...tmEvents
  ]) {
    await upsertEvent(event);
  }

  console.log("Test");
  console.log(raEvents);

  return Response.json({
    events: await getEvents(),
    artistsSearched: artistList.length,
    found: raEvents.length,
    // + tmEvents.length,
  });
}
