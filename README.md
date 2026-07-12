# Music Spider

Music Spider uses your listening history (Plex/Tautulli and/or Spotify) to gather your top artists - most listened to (short and long term), searches for upcoming events from those artists near you, and notifies you by email, Google Calendar, or a generic webhook.

Everything is configured after the container is running, from the **Settings** tab in the app itself — nothing needs to be set in code or env files to get started beyond what's covered below.

## Requirements

To install:

- Docker

Artists Source Options:

- Tautulli (API key needed from Tautulli settings)
- Spotify ([API key needed](https://developer.spotify.com/))
- List of Artists manully added

Event Search options:

- Ticketmster ([API key](https://developer.ticketmaster.com/) needed)
- Resident Advisor (no API key needed)

Notification Options

- Email (requires OAuth or a [webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md))
- Calendar (requires OAuth or a [webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md))

## Running it

- [Set up using Docker Compose](https://github.com/cparsell/music-spider-service/blob/main/Setup-DockerCompose.md)
- [Set on Unraid](https://github.com/cparsell/music-spider-service/blob/main/Setup-Unraid.md)

## Configuring the app

Every setting below lives in the **Settings** tab and auto-saves as you type — there's no separate save button. Sections are collapsible; only what you enable actually gets used (disabled sections make no API calls).

### Artists

Choose where your "top artists" list comes from, under **Artists > Artist Sources**:

- **Tautulli only** — pulls play counts from your Tautulli instance (Plex). Requires the Tautulli URL, an API key (Tautulli > Settings > Web Interface > API), and optionally a Music Section ID to limit it to one library (find it in Tautulli under Libraries > Music — it appears in the URL as `section_id=X`).
- **Spotify only** — pulls your Spotify top artists. Requires a Spotify app: go to the [Spotify Developer Dashboard](https://developer.spotify.com/), create an app, copy the Redirect URI shown in Music Spider's Spotify section into the app's settings, then paste the app's Client ID/Secret back into Music Spider and click **Connect Spotify Account**.
- **Both** — merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify fills in anything Tautulli didn't surface. Requires both sets of credentials above.

Only the source(s) you pick need credentials — the other section grays out and is skipped entirely.

### Event Search

Pick one or both sources under **Event Search > Event Search Sources**:

- **Ticketmaster** — requires a free [Ticketmaster API key](https://developer.ticketmaster.com/), plus your location as `Lat/Long` and a search `Radius` (in miles or km).
- **Resident Advisor** — no API key needed. Just open the **Resident Advisor** subsection and use the region search box to find and add your city/country — matching events near those regions are pulled automatically.

### Notifications

Configured under the **Notification** section, once events are found:

- **Email** and/or **Google Calendar** — enable "Send a weekly email digest" and/or "Add newly found events to Google Calendar" under **Google (Email & Calendar)**. Pick one of two ways to let Music Spider actually talk to Google:
  - **OAuth** — connects a Google account directly. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI shown in Music Spider as an authorized redirect URI. Enter the Client ID/Secret, then click **Connect Google Account**. This only works over HTTPS once you're accessing Music Spider from anywhere other than `127.0.0.1`/`localhost` — see [Google OAuth and HTTPS](#google-oauth-and-https) below.
  - **Apps Script Webhook** — send email/calendar actions through a small script you deploy yourself instead. No OAuth client, redirect URI, or HTTPS needed on Music Spider's end. See [Setting up the Apps Script webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md).
- **Generic webhook** — enable "Send a weekly webhook digest" under **Webhook** and provide a URL that accepts an incoming POST (e.g. a Discord channel webhook, or a Home Assistant automation with a "Webhook" trigger). Customize the JSON body template using the `{{subject}}`, `{{summary}}`, and `{{count}}` placeholders — each is JSON-escaped automatically. Use the **Send Test Webhook** button to try it out.

Both the OAuth and Apps Script paths grant Music Spider send-only email access and calendar-event-creation access at most — never read/delete access to your existing mail or calendar. Review the source yourself before connecting either if you want to confirm that.

Use the **Send Test Email** / **Create Test Calendar Event** buttons in Music Spider's Settings to confirm it's wired up correctly.

### Google OAuth and HTTPS

If you choose the OAuth integration method (for Spotify or Google) and access Music Spider from anywhere other than `127.0.0.1`/`localhost` — e.g. a LAN IP, a hostname, or over the internet — **the redirect URI must be reachable at that same address, and Google in particular requires it to be HTTPS**. Put Music Spider behind a reverse proxy with TLS (e.g. Caddy, Traefik, or your NAS's built-in reverse proxy) if you want OAuth working from anything other than the same machine. The Apps Script webhook option sidesteps this entirely for Google.

The [Apps Script webhook script](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md) was set up as an alternative to the OAuth method - no HTTPS needed.
