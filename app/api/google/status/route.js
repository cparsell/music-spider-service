import {
  getStoredTokens,
  clearTokens,
  hasCalendarScope,
} from "@/lib/googleTokens.js";
import { getResolvedConfig } from "@/lib/settings.js";

async function getCalendarAvailable() {
  const config = await getResolvedConfig();
  if (config.googleIntegrationMode === "appsScript") {
    return !!(config.appsScriptWebhookUrl && config.appsScriptSharedSecret);
  }
  return hasCalendarScope();
}

export async function GET() {
  const tokens = await getStoredTokens();
  return Response.json({
    connected: !!tokens,
    scope: tokens?.scope || "",
    calendarAvailable: await getCalendarAvailable(),
  });
}

export async function DELETE() {
  await clearTokens();
  return Response.json({ connected: false });
}
