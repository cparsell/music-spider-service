import {
  manualArtists,
  addManualArtist,
  addManualArtists,
} from "@/lib/artistLists.js";

export async function GET() {
  return Response.json({ artists: await manualArtists.getAll() });
}

export async function POST(req) {
  const { name, names } = await req.json();
  try {
    const artists = Array.isArray(names)
      ? await addManualArtists(names)
      : await addManualArtist(name);
    return Response.json({ artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { name } = await req.json();
    const artists = await manualArtists.remove(name);
    return Response.json({ artists });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
