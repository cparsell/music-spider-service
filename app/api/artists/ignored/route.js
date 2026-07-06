import { ignoredArtists } from "@/lib/artistLists.js";

export async function GET() {
  return Response.json({ artists: await ignoredArtists.getAll() });
}

export async function POST(req) {
  const { name, names } = await req.json();
  try {
    const artists = Array.isArray(names)
      ? await ignoredArtists.addMany(names)
      : await ignoredArtists.add(name);
    return Response.json({ artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  const { name } = await req.json();
  const artists = await ignoredArtists.remove(name);
  return Response.json({ artists });
}
