import { getConfiguredTopArtists } from "./artistSources.js";
import { getResolvedConfig } from "./settings.js";
import { setCachedTermResult } from "./topArtistsCache.js";

// Cache keys pre-warmed by a refresh: each individual term, plus "combined"
// for the all-three default. Any other subset (e.g. just short+long) is a
// less common on-demand choice - see cacheKeyForTerms() in the top-artists
// route, which computes those live instead of caching every possible
// combination.
const CACHE_ENTRIES = [
  { key: "short_term", terms: ["short_term"] },
  { key: "medium_term", terms: ["medium_term"] },
  { key: "long_term", terms: ["long_term"] },
  { key: "combined", terms: ["short_term", "medium_term", "long_term"] },
];

/**
 * Force-refreshes all four cached top-artists lists (short/medium/long/
 * combined), bypassing whatever's currently cached. Shared by the manual
 * "Refresh All" button and the scheduled auto-refresh check.
 */
export async function refreshAllTopArtistLists() {
  const config = await getResolvedConfig();
  const counts = {};
  const errors = {};

  await Promise.all(
    CACHE_ENTRIES.map(async ({ key, terms }) => {
      try {
        const { artists, spotifyError } = await getConfiguredTopArtists(
          terms,
          config.maxTopArtistsCount,
          config.combinedTopArtistsMode,
        );
        await setCachedTermResult(key, { artists, spotifyError });
        counts[key] = artists.length;
      } catch (err) {
        errors[key] = err.message;
      }
    }),
  );

  return { counts, errors: Object.keys(errors).length > 0 ? errors : undefined };
}
