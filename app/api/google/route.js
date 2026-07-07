import { randomUUID } from "crypto";
import { getResolvedConfig } from "@/lib/settings.js";

// Starts the Google OAuth flow: redirects the user to Google's consent
// screen. The callback lands at app/api/google/callback/route.js.
export async function GET() {
  const config = await getResolvedConfig();
  if (!config.googleClientId || !config.googleRedirectUri) {
    return Response.json(
      { error: "Google client ID / redirect URI not configured in Settings" },
      { status: 400 },
    );
  }

  const scopes = ["https://www.googleapis.com/auth/gmail.send"];
  if (config.googleCalendarSyncEnabled) {
    scopes.push("https://www.googleapis.com/auth/calendar.events");
  }

  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    response_type: "code",
    redirect_uri: config.googleRedirectUri,
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      "Set-Cookie": `google_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
    },
  });
}
