import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const IGNORED_EVENTS_FILE = "ignored-events.json";

function normalize(str) {
  return (str || "").trim().toLowerCase();
}

// Local calendar day, not exact timestamp - sources sometimes report
// slightly different times for the same night (see sameCalendarDay in
// eventsStore.js), so matching on day keeps that consistent here too.
function dayKey(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d)) return String(dateValue);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Identifies one specific night of one specific event (eName + venue +
// date) rather than the whole eName/venue series - ignoring a card should
// only suppress the date(s) it actually showed, not a future night of the
// same recurring show at the same venue.
export function eventIgnoreKey({ eName, venue }, date) {
  return `${normalize(eName)}::${normalize(venue)}::${dayKey(date)}`;
}

export const ignoredEvents = {
  async getAll() {
    return readJsonFile(IGNORED_EVENTS_FILE, []);
  },
  // Ignores every date in `dates` (e.g. all nights of a multi-night card)
  // for the given event.
  async addDates(event, dates) {
    const keys = (dates || []).map((date) => eventIgnoreKey(event, date));
    return withLock(IGNORED_EVENTS_FILE, async () => {
      const list = await readJsonFile(IGNORED_EVENTS_FILE, []);
      for (const key of keys) {
        if (!list.includes(key)) list.push(key);
      }
      await writeJsonFile(IGNORED_EVENTS_FILE, list);
      return list;
    });
  },
};
