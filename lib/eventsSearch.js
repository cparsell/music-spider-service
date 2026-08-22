import { getCombinedArtistList } from "@/lib/combinedArtistList.js";
import { searchRA } from "@/app/api/events/resadvisor/route.js";
import { searchTMLoop } from "@/app/api/events/ticketmaster/route.js";
import {
  upsertEvent,
  getEvents,
  setDateCalendarEventId,
  setDateCalDavEventId,
  attachIsNew,
} from "@/lib/eventsStore.js";
import { ignoredEvents, eventIgnoreKey } from "@/lib/ignoredEvents.js";
import { setProgress, isCancelRequested } from "@/lib/searchProgress.js";
import { attachActsDisplay } from "@/lib/formatActs.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { hasCalendarScope } from "@/lib/googleTokens.js";
import { createCalendarEvent } from "@/lib/googleCalendar.js";
import { isServiceAccountEnabled } from "@/lib/googleServiceAccount.js";
import { isCalDavConfigured, createCalDavEvent } from "@/lib/caldav.js";

const STAGE_WEIGHTS = {
  searching: 0.7,
  saving: 0.15,
  calendar: 0.1,
  caldav: 0.05,
};
const PROGRESS_SCALE = 1000;

/**
 * Tracks overall progress across the stages of one runEventSearch() call,
 * translating "N/total done within stage X" into a single completed/total
 * pair on the shared searchProgress state, so the reported percentage keeps
 * climbing across the whole operation instead of freezing once the first
 * stage (searching) hits its own 100%.
 * @param {string[]} enabledStages which of STAGE_WEIGHTS' keys apply this run
 */
function makeStageReporter(enabledStages) {
  const totalWeight = enabledStages.reduce(
    (sum, s) => sum + STAGE_WEIGHTS[s],
    0,
  );
  let doneWeight = 0;
  return {
    report(stage, stageCompleted, stageTotal, phase) {
      const stageWeight = STAGE_WEIGHTS[stage] / totalWeight;
      const stageFrac = stageTotal > 0 ? stageCompleted / stageTotal : 0;
      setProgress({
        phase,
        completed: Math.round(
          (doneWeight + stageWeight * stageFrac) * PROGRESS_SCALE,
        ),
        total: PROGRESS_SCALE,
      });
    },
    finishStage(stage) {
      doneWeight += STAGE_WEIGHTS[stage] / totalWeight;
    },
  };
}

/**
 * Syncs new event dates to the configured Google Calendar, creating a new
 * calendar event for each date and storing the resulting calendar event ID
 * in the events store.
 * @param {object} newDates { eventId, date, eventSnapshot }[]
 * @param {string} calendarId
 * @param {(processed: number, total: number) => void} [onProgress] called after each date, success or failure
 * @returns {Promise<{synced: number, error: string|null}>}
 */
async function syncNewDatesToCalendar(newDates, calendarId, onProgress) {
  let synced = 0;
  let error = null;
  let processed = 0;
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
    processed++;
    onProgress?.(processed, newDates.length);
  }
  return { synced, error };
}

/**
 * Same as `syncNewDatesToCalendar`, but for a CalDAV calendar - an
 * independent target, so it runs regardless of whether Google Calendar sync
 * is also enabled.
 * @param {object} newDates { eventId, date, eventSnapshot }[]
 * @param {(processed: number, total: number) => void} [onProgress] called after each date, success or failure
 * @returns {Promise<{synced: number, error: string|null}>}
 */
async function syncNewDatesToCalDav(newDates, onProgress) {
  let synced = 0;
  let error = null;
  let processed = 0;
  for (const { eventId, date, eventSnapshot } of newDates) {
    try {
      const dateEntry = eventSnapshot.dates.find((d) => d.date === date);
      const created = await createCalDavEvent({
        summary: eventSnapshot.eName,
        description: (eventSnapshot.acts || []).join(", "),
        location: eventSnapshot.address || eventSnapshot.venue,
        start: date,
        url: dateEntry?.urls?.[0]?.url,
      });
      await setDateCalDavEventId(eventId, date, created.id);
      synced++;
    } catch (err) {
      console.error("CalDAV sync error:", err.message);
      error = err.message;
    }
    processed++;
    onProgress?.(processed, newDates.length);
  }
  return { synced, error };
}

/**
 * Runs an event search across the configured sources (Ticketmaster/Resident
 * Advisor) for the current combined artist list, saves whatever's found, and
 * syncs new dates to Google Calendar and/or a CalDAV calendar if enabled.
 * Shared by the manual "Run Search" button and the scheduled auto-search.
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
    const enabledStages = [
      "searching",
      "saving",
      config.googleCalendarSyncEnabled && "calendar",
      config.caldavSyncEnabled && "caldav",
    ].filter(Boolean);
    const stages = makeStageReporter(enabledStages);
    const sources = config.eventSearchSources?.length
      ? config.eventSearchSources
      : ["ticketmaster", "resadvisor"];
    const searchTicketmaster = sources.includes("ticketmaster");
    const searchResidentAdvisor = sources.includes("resadvisor");

    const artistList = await getCombinedArtistList();

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

    // RA and Ticketmaster search in parallel. Track each source's
    // own completion separately so the phase text drops a source the moment
    // it actually finishes, instead of continuing to say "Searching
    // Ticketmaster" for however long RA still has left to run.
    // Ticketmaster's onProgress only covers resolving artists to attraction
    // IDs - searchTMLoop still has real work left after the last artist
    // resolves (the batched event search itself, then per-event image
    // lookups) before its promise actually settles, so once resolution hits
    // 100% the label switches to a distinct "fetching results" message
    // rather than sitting on "(298/298 artists)" as if it were done.
    let tmDone = !searchTicketmaster;
    let raDone = !searchResidentAdvisor;
    let tmProgress = { completed: 0, total: artistList.length };
    const reportSearching = () => {
      const tmLabel = tmDone
        ? null
        : tmProgress.total > 0 && tmProgress.completed >= tmProgress.total
          ? "Ticketmaster (fetching results)"
          : `Ticketmaster (${tmProgress.completed}/${tmProgress.total} artists)`;
      const stillSearching = [tmLabel, !raDone && "Resident Advisor"].filter(
        Boolean,
      );
      if (stillSearching.length === 0) return;
      stages.report(
        "searching",
        tmProgress.completed,
        tmProgress.total || 1,
        `Searching ${stillSearching.join(" and ")}...`,
      );
    };

    const [raEvents, tmEvents] = await Promise.all([
      (searchResidentAdvisor ? searchRA(artistList) : Promise.resolve([])).then(
        (events) => {
          raDone = true;
          reportSearching();
          return events;
        },
      ),
      (searchTicketmaster
        ? searchTMLoop(artistList, (completed, total) => {
            tmProgress = { completed, total };
            reportSearching();
          })
        : Promise.resolve([])
      ).then((events) => {
        tmDone = true;
        reportSearching();
        return events;
      }),
    ]);
    stages.finishStage("searching");

    // Save whatever was found even if the search was canceled partway
    // through, rather than discarding partial progress. Track which dates
    // were genuinely new (not just a merged duplicate URL) for calendar sync.
    const ignoredKeys = new Set(await ignoredEvents.getAll());
    const allEvents = [...raEvents, ...tmEvents];
    const newDates = [];
    if (allEvents.length > 0) {
      for (let i = 0; i < allEvents.length; i++) {
        const event = allEvents[i];
        if (!ignoredKeys.has(eventIgnoreKey(event, event.date))) {
          const result = await upsertEvent(event);
          if (result.isNewDate) {
            newDates.push(result);
          }
        }
        stages.report(
          "saving",
          i + 1,
          allEvents.length,
          `Saving events (${i + 1}/${allEvents.length})...`,
        );
      }
    }
    stages.finishStage("saving");

    let calendarSynced = 0;
    let calendarError = null;
    if (config.googleCalendarSyncEnabled) {
      if (newDates.length > 0) {
        // hasCalendarScope() checks the OAuth token's granted scope, which
        // has no equivalent in service account mode - there's no user grant
        // to check, so just attempt the sync and let a bad key surface as a
        // calendarError from syncNewDatesToCalendar itself.
        const authorized =
          isServiceAccountEnabled(config) || (await hasCalendarScope());
        if (authorized) {
          ({ synced: calendarSynced, error: calendarError } =
            await syncNewDatesToCalendar(
              newDates,
              config.calendarId,
              (processed, total) =>
                stages.report(
                  "calendar",
                  processed,
                  total,
                  `Syncing to Google Calendar (${processed}/${total})...`,
                ),
            ));
        } else {
          calendarError =
            "Google Calendar sync is enabled but not authorized. Reconnect Google in Settings.";
        }
      }
      stages.finishStage("calendar");
    }

    let caldavSynced = 0;
    let caldavError = null;
    if (config.caldavSyncEnabled) {
      if (newDates.length > 0) {
        if (isCalDavConfigured(config)) {
          ({ synced: caldavSynced, error: caldavError } =
            await syncNewDatesToCalDav(newDates, (processed, total) =>
              stages.report(
                "caldav",
                processed,
                total,
                `Syncing to CalDAV (${processed}/${total})...`,
              ),
            ));
        } else {
          caldavError =
            "CalDAV sync is enabled but not fully configured. Add the URL/username/password in Settings.";
        }
      }
      stages.finishStage("caldav");
    }

    setProgress({ completed: PROGRESS_SCALE });

    const result = {
      artistsSearched: artistList.length,
      found: raEvents.length + tmEvents.length,
      newFound: newDates.length,
      canceled: isCancelRequested(),
      calendarSynced,
      calendarError,
      caldavSynced,
      caldavError,
    };
    // Stored on the shared progress state (not just returned here) so a
    // client that reconnects after switching away mid-search - rather than
    // the one that made this request - can still learn how it turned out.
    setProgress({ result });
    return {
      events: attachIsNew(await attachActsDisplay(await getEvents())),
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
