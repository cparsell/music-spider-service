import { getStoredTokens, clearTokens } from "@/lib/googleTokens.js";

export async function GET() {
  const tokens = await getStoredTokens();
  return Response.json({ connected: !!tokens, scope: tokens?.scope || "" });
}

export async function DELETE() {
  await clearTokens();
  return Response.json({ connected: false });
}
