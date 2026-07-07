import { getTopArtists, getCombinedTopArtists } from "./tautulli.js";
import { manualArtists, ignoredArtists } from "./artistLists.js";
import { getResolvedConfig } from "./settings.js";

/**
 * Builds the artist list used to search for events: your top-artists
 * history (from whichever term window(s) are configured in Settings) plus
 * manually-added artists, minus anything on the ignore list.
 */
export async function getCombinedArtistList() {
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
  const names = new Set([...topArtists.map((a) => a.artist), ...manual]);

  return [...names].filter((name) => !ignoredSet.has(name));
}
