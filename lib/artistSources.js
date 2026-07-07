import { getTopArtists, getCombinedTopArtists } from "./tautulli.js";
import { getSpotifyTopArtists } from "./spotify.js";
import { getValidSpotifyAccessToken } from "./spotifyTokens.js";
import { getResolvedConfig } from "./settings.js";

async function getSpotifyArtistsForTerm(term, count) {
  const accessToken = await getValidSpotifyAccessToken();

  if (term === "combined") {
    // Spotify has no native "combined" view and no real play counts to
    // weight by, so we just union its three term lists.
    const [short, medium, long] = await Promise.all([
      getSpotifyTopArtists(accessToken, "short_term", count),
      getSpotifyTopArtists(accessToken, "medium_term", count),
      getSpotifyTopArtists(accessToken, "long_term", count),
    ]);
    const seen = new Set();
    const merged = [];
    for (const list of [short, medium, long]) {
      for (const item of list) {
        if (!seen.has(item.artist)) {
          seen.add(item.artist);
          merged.push({ artist: item.artist, plays: null });
        }
      }
    }
    return merged;
  }

  const list = await getSpotifyTopArtists(accessToken, term, count);
  return list.map((item) => ({ artist: item.artist, plays: null }));
}

/**
 * Returns the top-artists list from whichever source(s) are configured in
 * Settings ("tautulli", "spotify", or "both").
 *
 * In "both" mode: Tautulli's real play counts win for any artist it already
 * knows about (kept in its original rank order); Spotify only contributes
 * additional artists it surfaced that Tautulli didn't, appended after with
 * no play count (Spotify's API doesn't expose one).
 */
export async function getConfiguredTopArtists(term, count, combinedMode) {
  const config = await getResolvedConfig();
  const source = config.artistSource || "tautulli";

  const tautulliList =
    source !== "spotify"
      ? term === "combined"
        ? await getCombinedTopArtists(count, combinedMode)
        : await getTopArtists(term, count)
      : [];

  if (source === "tautulli") {
    return { artists: tautulliList };
  }

  let spotifyList = [];
  let spotifyError = null;
  try {
    spotifyList = await getSpotifyArtistsForTerm(term, count);
  } catch (err) {
    spotifyError = err.message;
    if (source === "spotify") throw err;
  }

  if (source === "spotify") {
    return { artists: spotifyList.slice(0, count) };
  }

  const seen = new Set(tautulliList.map((a) => a.artist));
  const merged = [...tautulliList];
  for (const s of spotifyList) {
    if (!seen.has(s.artist)) {
      merged.push(s);
      seen.add(s.artist);
    }
  }
  return { artists: merged.slice(0, count), spotifyError };
}
