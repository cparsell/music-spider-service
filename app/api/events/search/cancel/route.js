import { requestCancel } from "@/lib/searchProgress.js";

export async function POST() {
  requestCancel();
  return Response.json({ ok: true });
}
