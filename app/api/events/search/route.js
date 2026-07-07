import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import { searchRA } from "../resadvisor/route.js";
import { searchTMLoop } from "../ticketmaster/route.js";
import { upsertEvent, getEvents } from "@/lib/eventsStore.js";
import { setProgress, isCancelRequested } from "@/lib/searchProgress.js";

export async function POST() {
  setProgress({
    running: true,
    phase: "Building artist list...",
    completed: 0,
    total: 0,
    cancelRequested: false,
  });

  try {
    const artistList = await getCombinedArtistList();

    setProgress({
      phase: `Searching Ticketmaster and Resident Advisor (0/${artistList.length} artists)...`,
      completed: 0,
      total: artistList.length,
    });

    const [raEvents, tmEvents] = await Promise.all([
      searchRA(artistList),
      searchTMLoop(artistList, (completed, total) => {
        setProgress({
          completed,
          total,
          phase: `Searching Ticketmaster (${completed}/${total} artists)...`,
        });
      }),
    ]);

    // Save whatever was found even if the search was canceled partway
    // through, rather than discarding partial progress.
    for (const event of [...raEvents, ...tmEvents]) {
      await upsertEvent(event);
    }

    return Response.json({
      events: await getEvents(),
      artistsSearched: artistList.length,
      found: raEvents.length + tmEvents.length,
      canceled: isCancelRequested(),
    });
  } finally {
    setProgress({ running: false });
  }
}
