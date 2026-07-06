export async function getSpotifyTopArtists(
  accessToken,
  term = "medium_term",
  limit = 50,
) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/top/artists?time_range=${term}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  const data = await res.json();
  return data.items.map((a) => ({ artist: a.name, popularity: a.popularity }));
}
