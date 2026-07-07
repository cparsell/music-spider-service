import { getResolvedConfig } from "./settings.js";

export const TERM_WINDOWS = {
  short_term: 28,
  medium_term: 182,
  long_term: null, // null = no 'after' filter, full history
};

export async function getTopArtists(term = "medium_term", count = 200) {
  const config = await getResolvedConfig();
  const days = TERM_WINDOWS[term];
  const artistCounts = {};
  let start = 0;
  const pageSize = 1000;
  let hasMore = true;

  const baseParams = {
    apikey: config.tautulliApiKey,
    cmd: "get_history",
    media_type: "track",
    section_id: config.tautulliMusicSectionId,
    length: pageSize,
    order_column: "date",
    order_dir: "desc",
  };
  if (days) {
    const after = new Date(Date.now() - days * 86400 * 1000);
    baseParams.after = after.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  while (hasMore) {
    const params = new URLSearchParams({ ...baseParams, start });
    const res = await fetch(`${config.tautulliUrl}/api/v2?${params}`);
    const json = await res.json();
    const rows = json.response.data.data;

    for (const row of rows) {
      const artist = row.grandparent_title;
      if (artist) artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    }

    hasMore = rows.length === pageSize;
    start += pageSize;
  }

  return Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([artist, plays]) => ({ artist, plays }));
}

// Recent plays are weighted more heavily than older ones so the ranking
// favors artists you're actively listening to now.
const WEIGHTS = { short_term: 3, medium_term: 2, long_term: 1 };

/**
 * Fetches full play history once and buckets each play into short/medium/
 * long term windows, then combines the selected windows into a single
 * ranked list.
 * @param {number} count
 * @param {"weighted"|"union"} mode
 *   "weighted" - one score per artist combining the selected windows, recent
 *     plays weighted more heavily.
 *   "union" - takes the top `count` artists from each selected window and
 *     merges them into one deduplicated list, sorted by all-time plays.
 * @param {Array<"short_term"|"medium_term"|"long_term">} terms which windows to combine
 */
export async function getCombinedTopArtists(
  count = 200,
  mode = "weighted",
  terms = ["short_term", "medium_term", "long_term"],
) {
  const config = await getResolvedConfig();
  const now = Math.floor(Date.now() / 1000);
  const cutoffs = {
    short_term: now - TERM_WINDOWS.short_term * 86400,
    medium_term: now - TERM_WINDOWS.medium_term * 86400,
  };

  const counts = {}; // artist -> { short_term, medium_term, long_term }
  let start = 0;
  const pageSize = 1000;
  let hasMore = true;

  const baseParams = {
    apikey: config.tautulliApiKey,
    cmd: "get_history",
    media_type: "track",
    section_id: config.tautulliMusicSectionId,
    length: pageSize,
    order_column: "date",
    order_dir: "desc",
  };

  while (hasMore) {
    const params = new URLSearchParams({ ...baseParams, start });
    const res = await fetch(`${config.tautulliUrl}/api/v2?${params}`);
    const json = await res.json();
    const rows = json.response.data.data;

    for (const row of rows) {
      const artist = row.grandparent_title;
      if (!artist) continue;
      if (!counts[artist]) {
        counts[artist] = { short_term: 0, medium_term: 0, long_term: 0 };
      }
      counts[artist].long_term += 1;
      if (row.date >= cutoffs.medium_term) counts[artist].medium_term += 1;
      if (row.date >= cutoffs.short_term) counts[artist].short_term += 1;
    }

    hasMore = rows.length === pageSize;
    start += pageSize;
  }

  if (mode === "union") {
    const topSet = new Set();
    for (const key of terms) {
      Object.entries(counts)
        .sort((a, b) => b[1][key] - a[1][key])
        .slice(0, count)
        .forEach(([artist]) => topSet.add(artist));
    }
    return [...topSet]
      .map((artist) => ({ artist, plays: counts[artist].long_term }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, count);
  }

  return Object.entries(counts)
    .map(([artist, c]) => ({
      artist,
      plays: c.long_term,
      score: terms.reduce((sum, term) => sum + c[term] * WEIGHTS[term], 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ artist, plays }) => ({ artist, plays }));
}
