import { TERM_WINDOWS } from "@/lib/tautulli.js";
import { getConfiguredTopArtists } from "@/lib/artistSources.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { ignoredArtists } from "@/lib/artistLists.js";
import { getCachedTermResult } from "@/lib/topArtistsCache.js";
import { refreshAllTopArtistLists } from "@/lib/topArtistsRefresh.js";

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
      const ignoredSet = new Set(await ignoredArtists.getAll());
      const artists = cached.artists
        .slice(0, count)
        .map((a) => ({ ...a, ignored: ignoredSet.has(a.artist) }));
      return Response.json({
        term,
        mode: term === "combined" ? mode : undefined,
        artists,
        spotifyError: cached.spotifyError,
        cachedAt: cached.cachedAt,
      });
    }

    // No usable cache for this term - refresh every term together (same
    // as the "Force Refresh" button) so switching tabs never leaves the
    // others stale from this point on.
    const { errors } = await refreshAllTopArtistLists();
    const refreshed = await getCachedTermResult(term);
    if (refreshed) {
      const ignoredSet = new Set(await ignoredArtists.getAll());
      const artists = refreshed.artists
        .slice(0, count)
        .map((a) => ({ ...a, ignored: ignoredSet.has(a.artist) }));
      return Response.json({
        term,
        mode: term === "combined" ? mode : undefined,
        artists,
        spotifyError: refreshed.spotifyError,
        cachedAt: refreshed.cachedAt,
      });
    }
    return Response.json(
      { error: errors?.[term] || "Failed to load top artists" },
      { status: 500 },
    );
  }

  try {
    const { artists, spotifyError } = await getConfiguredTopArtists(
      term,
      count,
      mode,
    );
    return Response.json({
      term,
      mode: term === "combined" ? mode : undefined,
      artists,
      spotifyError,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
