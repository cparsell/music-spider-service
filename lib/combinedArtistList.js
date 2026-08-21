import { manualArtists, ignoredArtists } from "./artistLists.js";
import { getResolvedConfig } from "./settings.js";
import { getCachedTermResult, cacheKeyForTerms } from "./topArtistsCache.js";
import { refreshAllTopArtistLists } from "./topArtistsRefresh.js";
import { getConfiguredTopArtists } from "./artistSources.js";

/**
 * Top-artists portion of the combined list, read from the disk-backed cache
 * that's kept fresh by the auto-refresh setting (see
 * topArtistsRefreshScheduler.js) rather than hitting Tautulli/Spotify live.
 * Falls back to a live fetch for an uncommon term combination that isn't
 * one of the four proactively cached entries (see cacheKeyForTerms).
 */
async function getCachedTopArtists(terms, config) {
  const cacheKey = cacheKeyForTerms(terms);
  if (!cacheKey) {
    const { artists } = await getConfiguredTopArtists(
      terms,
      500,
      config.combinedTopArtistsMode,
    );
    return artists;
  }

  const cached = await getCachedTermResult(cacheKey);
  if (cached) return cached.artists;

  // No cache yet - e.g. the very first request before the startup refresh
  // in instrumentation.js has finished. Populate it once rather than
  // searching with an empty artist list.
  await refreshAllTopArtistLists();
  return (await getCachedTermResult(cacheKey))?.artists || [];
}

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

  const [topArtists, manual, ignored] = await Promise.all([
    getCachedTopArtists(terms, config),
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
  return [...seen.values()].filter((name) => !ignoredSet.has(name));
}
