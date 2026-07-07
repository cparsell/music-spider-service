import { getResolvedConfig } from "@/lib/settings.js";
import { saveTokens } from "@/lib/googleTokens.js";

// This runs inside the popup window opened by the "Connect Google Account"
// button. If it has an opener (the popup case), it reports back via
// postMessage and closes itself so the main window never navigates away.
// If there's no opener (e.g. popup blocked, or this URL was opened
// directly), it falls back to a normal redirect back to the app.
function finish(status, message) {
  const html = `<!DOCTYPE html>
<html><body>
<script>
  var payload = { source: "google-oauth", status: ${JSON.stringify(status)}, message: ${JSON.stringify(message)} };
  if (window.opener) {
    window.opener.postMessage(payload, "*");
    window.close();
  } else {
    window.location.href = "/?tab=settings&google=" + encodeURIComponent(payload.message);
  }
</script>
${message}
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": "google_oauth_state=; Path=/; Max-Age=0",
    },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  if (error) {
    return finish("error", `Google authorization failed: ${error}`);
  }
  if (!code || !state || state !== cookieState) {
    return finish("error", "Google authorization failed: invalid state");
  }

  const config = await getResolvedConfig();
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.googleRedirectUri,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error_description || `Google token exchange failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.refresh_token) {
      throw new Error(
        "Google didn't return a refresh token. Try disconnecting and reconnecting.",
      );
    }
    await saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope || "",
    });
    return finish("success", "connected");
  } catch (err) {
    return finish("error", `Google connection error: ${err.message}`);
  }
}
