import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import { searchRA } from "@/app/api/events/resadvisor/route.js";
import { searchTMLoop } from "@/app/api/events/ticketmaster/route.js";
import {
  upsertEvent,
  getEvents,
  setDateCalendarEventId,
} from "@/lib/eventsStore.js";
import { setProgress, isCancelRequested } from "@/lib/searchProgress.js";
import { attachActsDisplay } from "@/lib/formatActs.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { hasCalendarScope } from "@/lib/googleTokens.js";
import { createCalendarEvent } from "@/lib/googleCalendar.js";

async function syncNewDatesToCalendar(newDates, calendarId) {
  let synced = 0;
  let error = null;
  for (const { eventId, date, eventSnapshot } of newDates) {
    try {
      const dateEntry = eventSnapshot.dates.find((d) => d.date === date);
      const created = await createCalendarEvent({
        calendarId,
        summary: eventSnapshot.eName,
        description: (eventSnapshot.acts || []).join(", "),
        location: eventSnapshot.address || eventSnapshot.venue,
        start: date,
        url: dateEntry?.urls?.[0]?.url,
      });
      await setDateCalendarEventId(eventId, date, created.id);
      synced++;
    } catch (err) {
      console.error("Calendar sync error:", err.message);
      error = err.message;
    }
  }
  return { synced, error };
}

/**
 * Runs an event search across the configured sources (Ticketmaster/Resident
 * Advisor) for the current combined artist list, saves whatever's found, and
 * syncs new dates to Google Calendar if enabled. Shared by the manual "Run
 * Search" button and the scheduled auto-search.
 */
export async function runEventSearch() {
  setProgress({
    running: true,
    phase: "Building artist list...",
    completed: 0,
    total: 0,
    cancelRequested: false,
  });

  try {
    const config = await getResolvedConfig();
    const sources = config.eventSearchSources?.length
      ? config.eventSearchSources
      : ["ticketmaster", "resadvisor"];
    const searchTicketmaster = sources.includes("ticketmaster");
    const searchResidentAdvisor = sources.includes("resadvisor");

    const artistList = await getCombinedArtistList({ fresh: true });

    const sourceLabel = [
      searchTicketmaster && "Ticketmaster",
      searchResidentAdvisor && "Resident Advisor",
    ]
      .filter(Boolean)
      .join(" and ");
    setProgress({
      phase: `Searching ${sourceLabel} (0/${artistList.length} artists)...`,
      completed: 0,
      total: artistList.length,
    });

    const [raEvents, tmEvents] = await Promise.all([
      searchResidentAdvisor ? searchRA(artistList) : Promise.resolve([]),
      searchTicketmaster
        ? searchTMLoop(artistList, (completed, total) => {
            setProgress({
              completed,
              total,
              phase: `Searching Ticketmaster (${completed}/${total} artists)...`,
            });
          })
        : Promise.resolve([]),
    ]);

    // Save whatever was found even if the search was canceled partway
    // through, rather than discarding partial progress. Track which dates
    // were genuinely new (not just a merged duplicate URL) for calendar sync.
    const newDates = [];
    for (const event of [...raEvents, ...tmEvents]) {
      const result = await upsertEvent(event);
      if (result.isNewDate) {
        newDates.push(result);
      }
    }

    let calendarSynced = 0;
    let calendarError = null;
    if (config.googleCalendarSyncEnabled && newDates.length > 0) {
      // hasCalendarScope() checks the OAuth token's granted scope, which
      // has no equivalent in Apps Script mode - there's no token to check,
      // so just attempt the sync and let a bad webhook URL/secret surface
      // as a calendarError from syncNewDatesToCalendar itself.
      const authorized =
        config.googleIntegrationMode === "appsScript" ||
        (await hasCalendarScope());
      if (authorized) {
        ({ synced: calendarSynced, error: calendarError } =
          await syncNewDatesToCalendar(newDates, config.calendarId));
      } else {
        calendarError =
          "Google Calendar sync is enabled but not authorized. Reconnect Google in Settings.";
      }
    }

    const result = {
      artistsSearched: artistList.length,
      found: raEvents.length + tmEvents.length,
      canceled: isCancelRequested(),
      calendarSynced,
      calendarError,
    };
    // Stored on the shared progress state (not just returned here) so a
    // client that reconnects after switching away mid-search - rather than
    // the one that made this request - can still learn how it turned out.
    setProgress({ result });
    return {
      events: await attachActsDisplay(await getEvents()),
      ...result,
    };
  } catch (err) {
    console.error("runEventSearch() error:", err);
    setProgress({ result: { error: err.message } });
    throw err;
  } finally {
    setProgress({ running: false });
  }
}
