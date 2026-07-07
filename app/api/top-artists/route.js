import { TERM_WINDOWS } from "@/lib/tautulli.js";
import { getConfiguredTopArtists } from "@/lib/artistSources.js";
import { getResolvedConfig } from "@/lib/settings.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const config = await getResolvedConfig();
  const term = searchParams.get("term") || "medium_term";
  const count = parseInt(
    searchParams.get("count") || String(config.maxTopArtistsCount),
    10,
  );

  if (term !== "combined" && !(term in TERM_WINDOWS)) {
    return Response.json({ error: "invalid term" }, { status: 400 });
  }

  const mode = searchParams.get("mode") || config.combinedTopArtistsMode;

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
