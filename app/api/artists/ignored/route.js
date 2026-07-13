import {
  ignoredArtists,
  addIgnoredArtist,
  addIgnoredArtists,
} from "@/lib/artistLists.js";

export async function GET() {
  return Response.json({ artists: await ignoredArtists.getAll() });
}

export async function POST(req) {
  const { name, names } = await req.json();
  try {
    const artists = Array.isArray(names)
      ? await addIgnoredArtists(names)
      : await addIgnoredArtist(name);
    return Response.json({ artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { name } = await req.json();
    const artists = await ignoredArtists.remove(name);
    return Response.json({ artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
