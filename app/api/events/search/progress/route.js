import { getProgress } from "@/lib/searchProgress.js";

export async function GET() {
  return Response.json(getProgress());
}
