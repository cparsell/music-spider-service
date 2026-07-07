import { getResolvedConfig } from "@/lib/settings.js";
import { saveTokens } from "@/lib/spotifyTokens.js";

// This runs inside the popup window opened by the "Connect Spotify Account"
// button. If it has an opener (the popup case), it reports back via
// postMessage and closes itself so the main window never navigates away.
// If there's no opener (e.g. popup blocked, or this URL was opened
// directly), it falls back to a normal redirect back to the app.
function finish(status, message) {
  const html = `<!DOCTYPE html>
<html><body>
<script>
  var payload = { source: "spotify-oauth", status: ${JSON.stringify(status)}, message: ${JSON.stringify(message)} };
  if (window.opener) {
    window.opener.postMessage(payload, "*");
    window.close();
  } else {
    window.location.href = "/?tab=settings&spotify=" + encodeURIComponent(payload.message);
  }
</script>
${message}
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": "spotify_oauth_state=; Path=/; Max-Age=0",
    },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieState = request.cookies.get("spotify_oauth_state")?.value;

  if (error) {
    return finish("error", `Spotify authorization failed: ${error}`);
  }
  if (!code || !state || state !== cookieState) {
    return finish("error", "Spotify authorization failed: invalid state");
  }

  const config = await getResolvedConfig();
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${config.spotifyClientId}:${config.spotifyClientSecret}`,
          ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.spotifyRedirectUri,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error_description || `Spotify token exchange failed: ${res.status}`);
    }
    const data = await res.json();
    await saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    return finish("success", "connected");
  } catch (err) {
    return finish("error", `Spotify connection error: ${err.message}`);
  }
}
