import { getTopArtists, getCombinedTopArtists } from "./tautulli.js";
import { getSpotifyTopArtists } from "./spotify.js";
import { getValidSpotifyAccessToken } from "./spotifyTokens.js";
import { getResolvedConfig } from "./settings.js";
import { ignoredArtists } from "./artistLists.js";

async function getSpotifyArtistsForTerms(terms, count) {
  const accessToken = await getValidSpotifyAccessToken();

  if (terms.length === 1) {
    const list = await getSpotifyTopArtists(accessToken, terms[0], count);
    return list.map((item) => ({ artist: item.artist, plays: null }));
  }

  // Spotify has no native "combined" view and no real play counts to
  // weight by, so we just union the selected term lists.
  const lists = await Promise.all(
    terms.map((term) => getSpotifyTopArtists(accessToken, term, count)),
  );
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item.artist)) {
        seen.add(item.artist);
        merged.push({ artist: item.artist, plays: null });
      }
    }
  }
  return merged;
}

/**
 * Returns the top-artists list from whichever source(s) are configured in
 * Settings ("tautulli", "spotify", or "both").
 *
 * In "both" mode: Tautulli's real play counts win for any artist it already
 * knows about (kept in its original rank order); Spotify only contributes
 * additional artists it surfaced that Tautulli didn't, appended after with
 * no play count (Spotify's API doesn't expose one).
 *
 * Artists on the ignore list are still included (flagged with `ignored:
 * true`) rather than removed - the caller decides how to display them.
 * @param {Array<"short_term"|"medium_term"|"long_term">} terms which
 *   window(s) to pull from - a single term returns that window's plain
 *   ranking, more than one combines them (see getCombinedTopArtists).
 */
export async function getConfiguredTopArtists(terms, count, combinedMode) {
  const config = await getResolvedConfig();
  const source = config.artistSource || "tautulli";
  const ignoredSet = new Set(await ignoredArtists.getAll());

  const tautulliList =
    source !== "spotify"
      ? terms.length === 1
        ? await getTopArtists(terms[0], count)
        : await getCombinedTopArtists(count, combinedMode, terms)
      : [];

  let artists;
  let spotifyError = null;

  if (source === "tautulli") {
    artists = tautulliList;
  } else {
    let spotifyList = [];
    try {
      spotifyList = await getSpotifyArtistsForTerms(terms, count);
    } catch (err) {
      spotifyError = err.message;
      if (source === "spotify") throw err;
    }

    if (source === "spotify") {
      artists = spotifyList;
    } else {
      const seen = new Set(tautulliList.map((a) => a.artist));
      artists = [...tautulliList];
      for (const s of spotifyList) {
        if (!seen.has(s.artist)) {
          artists.push(s);
          seen.add(s.artist);
        }
      }
    }
  }

  artists = artists
    .slice(0, count)
    .map((a) => ({ ...a, ignored: ignoredSet.has(a.artist) }));

  return { artists, spotifyError };
}
