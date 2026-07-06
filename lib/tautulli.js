const TERM_WINDOWS = {
  short_term: 28,
  medium_term: 182,
  long_term: null, // null = no 'after' filter, full history
};

async function getTopArtists(term = "medium_term", count = 200) {
  const days = TERM_WINDOWS[term];
  const artistCounts = {};
  let start = 0;
  const pageSize = 1000;
  let hasMore = true;

  const baseParams = {
    apikey: process.env.TAUTULLI_API_KEY,
    cmd: "get_history",
    media_type: "track",
    section_id: process.env.TAUTULLI_MUSIC_SECTION_ID,
    length: pageSize,
    order_column: "date",
    order_dir: "desc",
  };
  if (days) {
    baseParams.after = Math.floor(Date.now() / 1000) - days * 86400;
  }

  while (hasMore) {
    const params = new URLSearchParams({ ...baseParams, start });
    const res = await fetch(`${process.env.TAUTULLI_URL}/api/v2?${params}`);
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
