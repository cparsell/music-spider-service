import { getConfiguredTopArtists } from "./artistSources.js";
import { getResolvedConfig } from "./settings.js";
import { setCachedTermResult } from "./topArtistsCache.js";

const TERMS = ["short_term", "medium_term", "long_term", "combined"];

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
    TERMS.map(async (term) => {
      try {
        const { artists, spotifyError } = await getConfiguredTopArtists(
          term,
          config.maxTopArtistsCount,
          config.combinedTopArtistsMode,
        );
        await setCachedTermResult(term, { artists, spotifyError });
        counts[term] = artists.length;
      } catch (err) {
        errors[term] = err.message;
      }
    }),
  );

  return { counts, errors: Object.keys(errors).length > 0 ? errors : undefined };
}
