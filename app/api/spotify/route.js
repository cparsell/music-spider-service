import { randomUUID } from "crypto";
import { getResolvedConfig } from "@/lib/settings.js";

// Starts the Spotify OAuth flow: redirects the user to Spotify's consent
// screen. The callback lands at app/api/spotify/callback/route.js.
export async function GET() {
  const config = await getResolvedConfig();
  if (!config.spotifyClientId || !config.spotifyRedirectUri) {
    return Response.json(
      { error: "Spotify client ID / redirect URI not configured in Settings" },
      { status: 400 },
    );
  }

  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.spotifyClientId,
    response_type: "code",
    redirect_uri: config.spotifyRedirectUri,
    scope: "user-top-read",
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.spotify.com/authorize?${params}`,
      "Set-Cookie": `spotify_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
    },
  });
}
