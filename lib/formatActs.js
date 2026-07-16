import { getCombinedArtistList } from "./combinedArtistList.js";

function sortByKnown(acts, known) {
  return [...acts].sort((a, b) => {
    const aKnown = known.has(a) ? 0 : 1;
    const bKnown = known.has(b) ? 0 : 1;
    return aKnown - bKnown;
  });
}

/**
 * Sorts and caps an acts list (same order/limit as formatActsList), tagging
 * each act with whether it's in the user's known artist list.
 * @param {string[]} acts
 * @param {Set<string>|string[]} knownArtists
 * @param {number} maxCount
 * @returns {{ items: { name: string, known: boolean }[], truncated: boolean }}
 */
export function getActsList(acts, knownArtists, maxCount = 9) {
  if (!acts || acts.length === 0) return { items: [], truncated: false };
  const known =
    knownArtists instanceof Set ? knownArtists : new Set(knownArtists || []);
  const sorted = sortByKnown(acts, known);
  const items = sorted
    .slice(0, maxCount)
    .map((name) => ({ name, known: known.has(name) }));
  return { items, truncated: acts.length > maxCount };
}

/**
 * Formats an acts list for display: acts that are in the user's own artist
 * lists are shown first (stable sort - order within each group is
 * preserved), the whole thing capped at `maxCount` entries with a trailing
 * "..." if more were truncated.
 * @param {string[]} acts
 * @param {Set<string>|string[]} knownArtists
 * @param {number} maxCount
 * @param {(act: string) => string} [wrap] applied to each act name before
 *   joining - e.g. to wrap it in bold markup for a webhook digest. Defaults
 *   to the identity function, so callers that don't pass one (e.g. the
 *   web UI's card display) are unaffected.
 * @returns {string}
 */
export function formatActsList(
  acts,
  knownArtists,
  maxCount = 9,
  wrap = (a) => a,
) {
  const { items, truncated } = getActsList(acts, knownArtists, maxCount);
  if (items.length === 0) return "";
  const shown = items.map((item) => wrap(item.name)).join(", ");
  return truncated ? `${shown}...` : shown;
}

/**
 * Attaches an `actsDisplay` string (see formatActsList) to each event,
 * prioritizing artists from the user's own combined artist list.
 * @param {array} events
 */
export async function attachActsDisplay(events) {
  // The known-artist list is a "nice to have" here (it only affects display
  // order/highlighting) - if Tautulli/Spotify are unreachable, degrade to no
  // highlighting rather than failing the whole events list.
  let knownArtists = new Set();
  try {
    knownArtists = new Set(await getCombinedArtistList());
  } catch (err) {
    console.error(
      "attachActsDisplay: failed to load known artist list:",
      err.message,
    );
  }

  return events.map((e) => ({
    ...e,
    actsDisplay: formatActsList(e.acts, knownArtists),
    actsList: getActsList(e.acts, knownArtists),
  }));
}
