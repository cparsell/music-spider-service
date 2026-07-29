import { randomUUID, randomBytes, createHash } from "crypto";
import { getResolvedConfig } from "@/lib/settings.js";

// Starts the Spotify OAuth flow (Authorization Code with PKCE): redirects
// the user to Spotify's consent screen. No client secret is involved - the
// code_verifier below stands in for it, proving to Spotify's token endpoint
// that the app completing the exchange is the same one that started it.
// The callback lands at app/api/spotify/callback/route.js.
export async function GET() {
  const config = await getResolvedConfig();
  if (!config.spotifyClientId || !config.spotifyRedirectUri) {
    return Response.json(
      { error: "Spotify client ID / redirect URI not configured in Settings" },
      { status: 400 },
    );
  }

  const state = randomUUID();
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    client_id: config.spotifyClientId,
    response_type: "code",
    redirect_uri: config.spotifyRedirectUri,
    scope: "user-top-read",
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  const headers = new Headers({
    Location: `https://accounts.spotify.com/authorize?${params}`,
  });
  headers.append(
    "Set-Cookie",
    `spotify_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
  );
  headers.append(
    "Set-Cookie",
    `spotify_pkce_verifier=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
  );

  return new Response(null, { status: 302, headers });
}
