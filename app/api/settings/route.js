import { updateSettings, getResolvedConfig } from "@/lib/settings.js";

export async function GET() {
  return Response.json(await getResolvedConfig());
}

export async function POST(req) {
  const patch = await req.json();
  await updateSettings(patch);
  return Response.json(await getResolvedConfig());
}
