export async function getSpotifyTopArtists(
  accessToken,
  term = "medium_term",
  limit = 50,
) {
  const pageSize = 50; // Spotify's max per request
  const results = [];
  let offset = 0;

  while (results.length < limit) {
    const take = Math.min(pageSize, limit - offset);
    const res = await fetch(
      `https://api.spotify.com/v1/me/top/artists?time_range=${term}&limit=${take}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    results.push(
      ...items.map((a) => ({ artist: a.name, popularity: a.popularity })),
    );
    if (items.length < take) break; // no more results available
    offset += take;
  }

  return results;
}
