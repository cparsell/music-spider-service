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

// Two results describe the same event if they land on the same day, at the
// same venue, and share at least one act - names/venue phrasing often differ
// slightly between Ticketmaster and Resident Advisor.
function isSameEvent(a, b) {
  return (
    sameCalendarDay(a.date, b.date) &&
    normalize(a.venue) === normalize(b.venue) &&
    (a.acts || []).some((act) => (b.acts || []).includes(act))
  );
}

export async function getEvents() {
  return readJsonFile(EVENTS_FILE, []);
}

/**
 * Adds a new event, or if a matching event is already stored, merges in any
 * new ticket URLs/image/address instead of creating a duplicate entry.
 * @param {object} event {eName, venue, city, date, acts, urls: [{name, url}], image, address}
 */
export async function upsertEvent(event) {
  return withLock(EVENTS_FILE, async () => {
    const events = await readJsonFile(EVENTS_FILE, []);
    const existing = events.find((e) => isSameEvent(e, event));

    if (existing) {
      for (const urlEntry of event.urls || []) {
        if (!existing.urls.some((u) => u.name === urlEntry.name)) {
          existing.urls.push(urlEntry);
        }
      }
      existing.image ||= event.image;
      existing.address ||= event.address;
    } else {
      events.push({ id: randomUUID(), ...event });
    }

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
