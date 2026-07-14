# Music Spider

Music Spider is a self-hosted app that turns your listening history into a personalized concert-discovery tool. It pulls your top artists from Plex (via Tautulli) and/or Spotify, cross-references that list against event search APIs to find upcoming shows near you, and notifies you by email, Google Calendar, or a generic webhook.

## About

### Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Styling:** Tailwind CSS 4
- **Runtime:** Node 20, packaged as a Docker image
- **Storage:** flat JSON files on disk (no database) — settings, event store, artist lists, and caches, managed through a small custom file-store module with read/write locking
- **Auth:** OAuth flows for Spotify and Google, using popup windows for the consent step
- **External APIs:** Tautulli API, Spotify Web API, Ticketmaster Discovery API, Resident Advisor's public GraphQL API, Google **Gmail/Calendar APIs** — with a self-hosted Google Apps Script webhook offered as an OAuth-free alternative for email/calendar
- **Deployment:** Docker / Docker Compose, with docs for Unraid as well

### Features

- **Top Artists tracking** — from Tautulli, Spotify, both, or manual-only ("none"); short/medium/long-term windows combinable by weighted score or union; configurable max count; optional scheduled auto-refresh
- **Event search** — Ticketmaster (lat/long + radius) and/or Resident Advisor (region-based), matched against your top-artist list; manual search with live progress/cancel, or scheduled auto-search;
- **Events UI** — Peruse the discovered events in card and list views, sortable columns, per-event delete/ignore
- **Custom & Ignore lists** — manually pin artists to always include, or exclude specific artists from top-artists and event search entirely
- **Notifications** —
  - weekly event digest email,
  - Google Calendar sync, and a generic JSON webhook (e.g. Discord, Home Assistant) with a customizable template and per-channel test-send buttons
- **Settings UI** — every integration configured and auto-saved from one in-app tab, with per-section enable/disable and live connection status
- **Theming** — Grayscale and Catppuccin Mocha themes
- **Apps Script Webhook Handler Script** (optional) - If one wants to avoid the OAuth process with Google (requires HTTPS), I use this Google Apps Script webapp to handle sending a weekly email and adding calendar events

## Requirements

**To install:**

- Docker
- Artists Source Options:
  - Tautulli (API key needed from Tautulli settings)
  - Spotify ([API key needed](https://developer.spotify.com/))
  - List of Artists manully added
- Event Search options:
  - Ticketmster ([API key](https://developer.ticketmaster.com/) needed)
  - Resident Advisor (no API key needed)
- Options for Notifications
  - Custom webhook - can be used to send event summary to Discord, Slack, etc.
  - [Apps Script webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md))
  - OAuth connection to Google ()

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

- **Ticketmaster** —
  - `API Key ` from [Ticketmaster Developer Dashboard](https://developer.ticketmaster.com/). Create an account then create an "app". **NOTE: Ticketmaster asks you to set a `Redirect URI` but it is unnecessary. You can set it to `http://127.0.0.1/` if required to get the API key**
  - `Lat/Long` of your area can be found at [latlong.net](https://www.latlong.net/)
  - `Radius` (in miles or km).
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

## License

[MIT](LICENSE)
