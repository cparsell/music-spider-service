import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const EVENTS_FILE = "events.json";

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

// Two results belong to the same event *series* (e.g. a multi-night run) if
// they're at the same venue and share at least one act - regardless of
// which night, so every date gets grouped under one entry instead of
// creating a separate card per night.
function isSameEventGroup(a, b) {
  return (
    normalize(a.venue) === normalize(b.venue) &&
    (a.acts || []).some((act) => (b.acts || []).includes(act))
  );
}

export async function getEvents() {
  return readJsonFile(EVENTS_FILE, []);
}

/**
 * Stored events with each event's `dates` trimmed down to only future
 * dates (a past night in a multi-night run shouldn't show up in a digest),
 * dropping events with no upcoming dates left, sorted by soonest first.
 */
export async function getUpcomingEvents() {
  const events = await getEvents();
  const now = new Date();
  return events
    .map((e) => ({
      ...e,
      dates: (e.dates || []).filter((d) => new Date(d.date) >= now),
    }))
    .filter((e) => e.dates.length > 0)
    .sort((a, b) => new Date(a.dates[0].date) - new Date(b.dates[0].date));
}

/**
 * Adds a new event date, grouping it under an existing event (same venue,
 * shared act) instead of creating a duplicate entry. Each stored event has
 * a `dates` array - one entry per night, each with its own ticket URLs - so
 * a multi-night run at the same venue shows as one card with a date/link
 * per night rather than several separate cards.
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
        });
        existing.dates.sort((a, b) => new Date(a.date) - new Date(b.date));
        isNewDate = true;
      }
      existing.image ||= event.image;
      existing.address ||= event.address;
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
        dates: [
          { date: event.date, urls: event.urls || [], calendarEventId: null },
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
