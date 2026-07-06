import { getTopArtists } from "./tautulli.js";
import { manualArtists, ignoredArtists } from "./artistLists.js";

/**
 * Builds the artist list used to search for events: your full top-artists
 * history plus manually-added artists, minus anything on the ignore list.
 */
export async function getCombinedArtistList() {
  const [topArtists, manual, ignored] = await Promise.all([
    getTopArtists("long_term", 500),
    manualArtists.getAll(),
    ignoredArtists.getAll(),
  ]);

  const ignoredSet = new Set(ignored);
  const names = new Set([...topArtists.map((a) => a.artist), ...manual]);

  return [...names].filter((name) => !ignoredSet.has(name));
}
