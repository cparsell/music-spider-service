import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const EVENTS_FILE = "events.json";
export const NEW_EVENT_THRESHOLD_DAYS = 14;

/**
 * Returns events with a boolean `isNew` added to each date entry, plus a
 * separate event-level `isNew` for the event title/card as a whole. These
 * are independent: the event-level flag reflects only whether the
 * *event itself* was newly created (`createdAt`), so a newly-announced
 * extra night on a show we already knew about marks just that date - not
 * the title - as new.
 *
 * A date entry only gets `foundAt` (and so can only be `isNew`) when it was
 * added to an event that already had at least one other date - i.e. a
 * newly-announced night was added. The very first date of a brand-new event
 * doesn't get one, since flagging it individually would just be redundant
 * with the event-level badge - see `createdAt` in `upsertEvent`.
 *
 * If every event comes out new, every event's `isNew` is forced back to
 * false instead. This is meant for when the store was empty before this
 * search (a brand-new event is the only way to get `isNew`, and a date can
 * only get it by being added to an event that already existed) - i.e. a
 * first-ever search, where "new" is meaningless since there's nothing to
 * compare against and a 100%-badged list conveys no information.
 * @param {*} events
 * @returns
 */
export function attachIsNew(events) {
  const cutoff = Date.now() - NEW_EVENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const flagged = events.map((e) => {
    const dates = (e.dates || []).map((d) => ({
      ...d,
      isNew: !!d.foundAt && new Date(d.foundAt).getTime() >= cutoff,
    }));
    const isNew = !!e.createdAt && new Date(e.createdAt).getTime() >= cutoff;
    return { ...e, dates, isNew };
  });

  if (flagged.length > 0 && flagged.every((e) => e.isNew)) {
    return flagged.map((e) => ({ ...e, isNew: false }));
  }
  return flagged;
}

function sameCalendarDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function normalize(str) {
  return (str || "").trim().toLowerCase();
}

// Sources sometimes list an unannounced venue as just "TBA", then later
// fill in more detail (e.g. "TBA - San Francisco") once it's known. Treat
// any such placeholder as a wildcard for grouping purposes so the same show
// doesn't get double-created as venue detail arrives across searches.
function isPlaceholderVenue(venue) {
  return normalize(venue).startsWith("tba");
}

// Two results belong to the same event *series* (e.g. a multi-night run) if
// they're at the same venue (or one/both venues are still an unannounced
// "TBA" placeholder) and share at least one act - regardless of which
// night, so every date gets grouped under one entry instead of creating a
// separate card per night.
function isSameEventGroup(a, b) {
  if (!(a.acts || []).some((act) => (b.acts || []).includes(act))) {
    return false;
  }
  if (isPlaceholderVenue(a.venue) || isPlaceholderVenue(b.venue)) return true;
  return normalize(a.venue) === normalize(b.venue);
}

export async function getEvents() {
  return readJsonFile(EVENTS_FILE, []);
}

/**
 * Returns the stored events with each event's `dates` trimmed down to only future
 * dates (ignoring events now past), dropping events with no upcoming dates left,
 * sorted by soonest first, with `isNew` attached (see `attachIsNew`) so the
 * email/webhook digests can flag recently-found events the same way the web
 * UI does.
 */
export async function getUpcomingEvents() {
  return attachIsNew(pruneExpiredEvents(await getEvents()));
}

/**
 * Adds a new event date, grouping it under an existing event (same venue,
 * shared act) instead of creating a duplicate entry. Each stored event has
 * a `dates` array - one entry per night, each with its own ticket URLs - so
 * a multi-night run at the same venue shows as one card with a date/link
 * per night rather than several separate cards. A brand-new event is
 * stamped with `createdAt`; a new night added to an event that already had
 * at least one date is stamped with its own `foundAt` instead (see
 * `attachIsNew`).
 * @param {object} event {eName, venue, city, date, acts, urls: [{name, url}], image, address}
 * @returns {object} { events, isNewDate, eventId, date, eventSnapshot } -
 *   `isNewDate` tells the caller whether this call actually created a new
 *   date entry (vs. just merging URLs into one that already existed), which
 *   is what determines whether it should be synced to Google Calendar.
 */
export async function upsertEvent(event) {
  return withLock(EVENTS_FILE, async () => {
    const events = await readJsonFile(EVENTS_FILE, []);
    const existing = events.find((e) => isSameEventGroup(e, event));
    let isNewDate = false;
    let eventId;

    if (existing) {
      eventId = existing.id;
      const existingDate = existing.dates.find((d) =>
        sameCalendarDay(d.date, event.date),
      );
      if (existingDate) {
        for (const urlEntry of event.urls || []) {
          if (!existingDate.urls.some((u) => u.name === urlEntry.name)) {
            existingDate.urls.push(urlEntry);
          }
        }
      } else {
        existing.dates.push({
          date: event.date,
          urls: event.urls || [],
          calendarEventId: null,
          foundAt: new Date().toISOString(),
        });
        existing.dates.sort((a, b) => new Date(a.date) - new Date(b.date));
        isNewDate = true;
      }
      existing.image ||= event.image;
      existing.address ||= event.address;
      // Prefer a more specific venue once one arrives, since the group may
      // have started out matched on a "TBA" placeholder.
      if (isPlaceholderVenue(existing.venue) && event.venue) {
        existing.venue = event.venue;
      }
      // Union of acts across nights, in case the lineup varies slightly.
      existing.acts = [
        ...new Set([...(existing.acts || []), ...(event.acts || [])]),
      ];
    } else {
      eventId = randomUUID();
      isNewDate = true;
      events.push({
        id: eventId,
        eName: event.eName,
        venue: event.venue,
        city: event.city,
        acts: event.acts || [],
        image: event.image,
        address: event.address,
        createdAt: new Date().toISOString(),
        dates: [
          {
            date: event.date,
            urls: event.urls || [],
            calendarEventId: null,
          },
        ],
      });
    }

    await writeJsonFile(EVENTS_FILE, events);
    return {
      events,
      isNewDate,
      eventId,
      date: event.date,
      eventSnapshot: events.find((e) => e.id === eventId),
    };
  });
}

/**
 * Records the Google Calendar event ID created for a specific date entry,
 * so a later search doesn't create a duplicate calendar event for it.
 */
export async function setDateCalendarEventId(eventId, date, calendarEventId) {
  return withLock(EVENTS_FILE, async () => {
    const events = await readJsonFile(EVENTS_FILE, []);
    const event = events.find((e) => e.id === eventId);
    const dateEntry = event?.dates.find((d) => d.date === date);
    if (dateEntry) dateEntry.calendarEventId = calendarEventId;
    await writeJsonFile(EVENTS_FILE, events);
    return events;
  });
}

export async function removeEvent(id) {
  return withLock(EVENTS_FILE, async () => {
    const events = (await readJsonFile(EVENTS_FILE, [])).filter(
      (e) => e.id !== id,
    );
    await writeJsonFile(EVENTS_FILE, events);
    return events;
  });
}

export function pruneExpiredEvents(events) {
  const now = new Date();
  return events
    .map((e) => ({
      ...e,
      dates: (e.dates || []).filter((d) => new Date(d.date) >= now),
    }))
    .filter((e) => e.dates.length > 0)
    .sort((a, b) => new Date(a.dates[0].date) - new Date(b.dates[0].date));
}

export async function pruneAndSaveExpiredEvents() {
  return withLock(EVENTS_FILE, async () => {
    const events = pruneExpiredEvents(await readJsonFile(EVENTS_FILE, []));
    await writeJsonFile(EVENTS_FILE, events);
    return events;
  });
}
