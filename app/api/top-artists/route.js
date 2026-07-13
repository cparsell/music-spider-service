import { TERM_WINDOWS } from "@/lib/tautulli.js";
import { getConfiguredTopArtists } from "@/lib/artistSources.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { ignoredArtists } from "@/lib/artistLists.js";
import { getCachedTermResult } from "@/lib/topArtistsCache.js";
import { refreshAllTopArtistLists } from "@/lib/topArtistsRefresh.js";

const ALL_TERMS = Object.keys(TERM_WINDOWS);

// Only the individual terms and the all-three default are proactively
// cached/refreshed (see topArtistsRefresh.js) - any other subset (e.g. just
// short+long) is computed live on each request instead of caching every
// possible combination.
function cacheKeyForTerms(terms) {
  if (terms.length === 1) return terms[0];
  if (terms.length === ALL_TERMS.length) return "combined";
  return null;
}

async function withIgnoredFlags(artists, count) {
  const ignoredSet = new Set(await ignoredArtists.getAll());
  return artists
    .slice(0, count)
    .map((a) => ({ ...a, ignored: ignoredSet.has(a.artist) }));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const config = await getResolvedConfig();
  const termsParam = searchParams.get("terms") || searchParams.get("term");
  const terms = termsParam
    ? [...new Set(termsParam.split(",").filter(Boolean))]
    : ["medium_term"];
  const explicitCount = searchParams.get("count");
  const explicitMode = searchParams.get("mode");
  const count = parseInt(
    explicitCount || String(config.maxTopArtistsCount),
    10,
  );

  if (terms.length === 0 || terms.some((t) => !(t in TERM_WINDOWS))) {
    return Response.json({ error: "invalid terms" }, { status: 400 });
  }

  const mode = explicitMode || config.combinedTopArtistsMode;

  // Only cache the "default" request shape (no explicit count/mode
  // override) - that's what the app's own UI always requests, and it's the
  // shape a manual refresh repopulates.
  const useCache = !explicitCount && !explicitMode;
  const cacheKey = useCache ? cacheKeyForTerms(terms) : null;

  if (cacheKey) {
    const cached = await getCachedTermResult(cacheKey);
    if (cached) {
      return Response.json({
        terms,
        mode: terms.length > 1 ? mode : undefined,
        artists: await withIgnoredFlags(cached.artists, count),
        spotifyError: cached.spotifyError,
        cachedAt: cached.cachedAt,
      });
    }

    // No usable cache for this term - refresh every term together (same
    // as the "Force Refresh" button) so switching tabs never leaves the
    // others stale from this point on.
    const { errors } = await refreshAllTopArtistLists();
    const refreshed = await getCachedTermResult(cacheKey);
    if (refreshed) {
      return Response.json({
        terms,
        mode: terms.length > 1 ? mode : undefined,
        artists: await withIgnoredFlags(refreshed.artists, count),
        spotifyError: refreshed.spotifyError,
        cachedAt: refreshed.cachedAt,
      });
    }
    return Response.json(
      { error: errors?.[cacheKey] || "Failed to load top artists" },
      { status: 500 },
    );
  }

  try {
    const { artists, spotifyError } = await getConfiguredTopArtists(
      terms,
      count,
      mode,
    );
    return Response.json({
      terms,
      mode: terms.length > 1 ? mode : undefined,
      artists: await withIgnoredFlags(artists, count),
      spotifyError,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
