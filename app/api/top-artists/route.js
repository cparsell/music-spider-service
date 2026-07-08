import { TERM_WINDOWS } from "@/lib/tautulli.js";
import { getConfiguredTopArtists } from "@/lib/artistSources.js";
import { getResolvedConfig } from "@/lib/settings.js";
import {
  getCachedTermResult,
  setCachedTermResult,
} from "@/lib/topArtistsCache.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const config = await getResolvedConfig();
  const term = searchParams.get("term") || "medium_term";
  const explicitCount = searchParams.get("count");
  const explicitMode = searchParams.get("mode");
  const count = parseInt(
    explicitCount || String(config.maxTopArtistsCount),
    10,
  );

  if (term !== "combined" && !(term in TERM_WINDOWS)) {
    return Response.json({ error: "invalid term" }, { status: 400 });
  }

  const mode = explicitMode || config.combinedTopArtistsMode;

  // Only cache the "default" request shape (no explicit count/mode
  // override) - that's what the app's own UI always requests, and it's the
  // shape a manual refresh repopulates.
  const useCache = !explicitCount && !explicitMode;

  if (useCache) {
    const cached = await getCachedTermResult(term);
    if (cached) {
      return Response.json({
        term,
        mode: term === "combined" ? mode : undefined,
        artists: cached.artists.slice(0, count),
        spotifyError: cached.spotifyError,
        cachedAt: cached.cachedAt,
      });
    }
  }

  try {
    const { artists, spotifyError } = await getConfiguredTopArtists(
      term,
      count,
      mode,
    );
    let cachedAt;
    if (useCache) {
      ({ cachedAt } = await setCachedTermResult(term, {
        artists,
        spotifyError,
      }));
    }
    return Response.json({
      term,
      mode: term === "combined" ? mode : undefined,
      artists,
      spotifyError,
      cachedAt,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
