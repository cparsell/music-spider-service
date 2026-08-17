import { getStoredTokens, clearTokens } from "@/lib/googleTokens.js";
import { isGoogleCalendarAvailable } from "@/lib/googleCalendar.js";

export async function GET() {
  const tokens = await getStoredTokens();
  return Response.json({
    connected: !!tokens,
    scope: tokens?.scope || "",
    calendarAvailable: await isGoogleCalendarAvailable(),
  });
}

export async function DELETE() {
  await clearTokens();
  return Response.json({ connected: false });
}
