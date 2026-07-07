import { getCombinedArtistList } from "./combinedArtistList.js";

/**
 * Formats an acts list for display: acts that are in the user's own artist
 * lists are shown first (stable sort - order within each group is
 * preserved), the whole thing capped at `maxCount` entries with a trailing
 * "..." if more were truncated.
 * @param {string[]} acts
 * @param {Set<string>|string[]} knownArtists
 * @param {number} maxCount
 * @returns {string}
 */
export function formatActsList(acts, knownArtists, maxCount = 9) {
  if (!acts || acts.length === 0) return "";
  const known =
    knownArtists instanceof Set ? knownArtists : new Set(knownArtists || []);

  const sorted = [...acts].sort((a, b) => {
    const aKnown = known.has(a) ? 0 : 1;
    const bKnown = known.has(b) ? 0 : 1;
    return aKnown - bKnown;
  });

  const shown = sorted.slice(0, maxCount).join(", ");
  return acts.length > maxCount ? `${shown}...` : shown;
}

/**
 * Attaches an `actsDisplay` string (see formatActsList) to each event,
 * prioritizing artists from the user's own combined artist list.
 * @param {array} events
 */
export async function attachActsDisplay(events) {
  const knownArtists = new Set(await getCombinedArtistList());
  return events.map((e) => ({
    ...e,
    actsDisplay: formatActsList(e.acts, knownArtists),
  }));
}
