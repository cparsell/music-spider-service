# Configuration

In the web UI, the settings live in the **Settings** tab and changes auto-save as you type.

## Artists

Choose where your "top artists" list comes from, under **Artists > Artist Sources**:

- **Tautulli only** - pulls play counts from your Tautulli instance (Plex). Requires the Tautulli URL, an API key (Tautulli > Settings > Web Interface > API), and optionally a Music Section ID to limit it to one library (find it in Tautulli under Libraries > Music - it appears in the URL as `section_id=X`).
- **Spotify only** - pulls your Spotify top artists. Requires a Spotify app: go to the [Spotify Developer Dashboard](https://developer.spotify.com/), create an app, copy the Redirect URI shown in Music Spider's Spotify section into the app's settings, then paste the app's Client ID/Secret back into Music Spider and click **Connect Spotify Account**.
- **Both** - merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify fills in anything Tautulli didn't surface. Requires both sets of credentials above.

## Event Search

Pick one or both sources under **Event Search > Event Search Sources**:

- **Ticketmaster**:
  - `API Key` from [Ticketmaster Developer Dashboard](https://developer.ticketmaster.com/). Create an account then create an "app". **NOTE: Ticketmaster asks you to set a `Redirect URI` but it is unnecessary. You can set it to `http://127.0.0.1/` if required to get the API key**
  - `Lat/Long` of your area can be found at [latlong.net](https://www.latlong.net/)
  - `Radius` (in miles or km).
- **Resident Advisor**: no API key needed. Just open the **Resident Advisor** subsection and use the region search box to find and add your city/country - matching events near those regions are pulled automatically.

## Notifications

Configured under the **Notification** section, once events are found:

- **Generic webhook**: enable "Send a weekly webhook digest" under **Webhook** and provide a URL that accepts an incoming POST (e.g. a Discord channel webhook, or a Home Assistant automation with a "Webhook" trigger). Customize the JSON body template using the `{{subject}}`, `{{summary}}`, and `{{count}}` placeholders - each is JSON-escaped automatically. Use the **Send Test Webhook** button to try it out.
- **Email**: enable "Send a weekly email digest"
- **Google Calendar**: If checked, "Add newly found events to Google Calendar" will sync all new events to the specified calendar. If unchecked, these can be added individually (manually).

Pick one of two ways to let Music Spider actually talk to Google (for Email and/or Calendar):

- **OAuth** - connects a Google account directly. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI shown in Music Spider as an authorized redirect URI. Enter the Client ID/Secret, then click **Connect Google Account**. This only works over HTTPS once you're accessing Music Spider from anywhere other than `127.0.0.1`/`localhost` - see [Google OAuth and HTTPS](#google-oauth-and-https) below.
- **Apps Script Webhook** - send email/calendar actions through a small script you deploy yourself instead. No OAuth client, redirect URI, or HTTPS needed on Music Spider's end. See [Setting up the Apps Script webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md).

Both the OAuth and Apps Script paths grant Music Spider send-only email access and calendar-event-creation access at most - never read/delete access to your existing mail or calendar. Review the source yourself before connecting either if you want to confirm that.

Use the **Send Test Email** / **Create Test Calendar Event** buttons in Music Spider's Settings to confirm it's wired up correctly.

## Google OAuth and HTTPS

If you choose the OAuth integration method (for Spotify or Google) and access Music Spider from anywhere other than `127.0.0.1`/`localhost` - e.g. a LAN IP, a hostname, or over the internet - **the redirect URI must be reachable at that same address, and Google in particular requires it to be HTTPS**. Put Music Spider behind a reverse proxy with TLS (e.g. Caddy, Traefik, SWAG, or your NAS's built-in reverse proxy) if you want OAuth working from anything other than the same machine.

The [Apps Script webhook script](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md) sidesteps this entirely for Google. It was set up as an alternative to the OAuth method - no HTTPS needed.

---

[Back to README](https://github.com/cparsell/music-spider-service/blob/main/README.md)
