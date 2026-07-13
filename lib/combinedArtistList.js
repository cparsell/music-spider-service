import { getTopArtists, getCombinedTopArtists } from "./tautulli.js";
import { manualArtists, ignoredArtists } from "./artistLists.js";
import { getResolvedConfig } from "./settings.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null; // { artists, expiresAt }

/**
 * Builds the artist list used to search for events: your top-artists
 * history (from whichever term window(s) are configured in Settings) plus
 * manually-added artists, minus anything on the ignore list.
 *
 * Cached for a few minutes by default since this hits Tautulli/Spotify and
 * is also used for cheap, cosmetic purposes (e.g. prioritizing acts you
 * know in an event's lineup). Pass `fresh: true` (used by the actual event
 * search) to bypass the cache and reflect the latest lists/settings.
 * @param {object} [options]
 * @param {boolean} [options.fresh]
 */
export async function getCombinedArtistList({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() < cache.expiresAt) {
    return cache.artists;
  }

  const config = await getResolvedConfig();
  const terms =
    config.eventSearchTerms && config.eventSearchTerms.length > 0
      ? config.eventSearchTerms
      : ["long_term"];

  const topArtistsPromise =
    terms.length === 1
      ? getTopArtists(terms[0], 500)
      : getCombinedTopArtists(500, config.combinedTopArtistsMode, terms);

  const [topArtists, manual, ignored] = await Promise.all([
    topArtistsPromise,
    manualArtists.getAll(),
    ignoredArtists.getAll(),
  ]);

  const ignoredSet = new Set(ignored);
  // Case-insensitive dedup - ticket search APIs don't care about case, so
  // "Four Tet" and "four tet" would otherwise search the same artist twice.
  // Keeps whichever casing is encountered first (top artists before manual,
  // matching the order below).
  const seen = new Map();
  for (const name of [...topArtists.map((a) => a.artist), ...manual]) {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  const artists = [...seen.values()].filter((name) => !ignoredSet.has(name));

  cache = { artists, expiresAt: Date.now() + CACHE_TTL_MS };
  return artists;
}
