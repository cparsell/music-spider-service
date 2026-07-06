import { getTopArtists } from "@/lib/tautulli";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const term = searchParams.get("term") || "medium_term";
  const count = parseInt(searchParams.get("count") || "200", 10);

  if (!(term in TERM_WINDOWS)) {
    return Response.json({ error: "invalid term" }, { status: 400 });
  }

  try {
    const artists = await getTopArtists(term, count);
    return Response.json({ term, artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
