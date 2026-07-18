# Music Spider

Music Spider is a self-hosted tool for turning your listening history into a concert-discovery tool. It pulls your top artists from Plex (via Tautulli) and/or Spotify, cross-references that list against event search APIs to find upcoming shows near you, and notifies you by email, Google Calendar, or a generic webhook.

I first programmed [Music Spider](https://github.com/cparsell/music-spider) in Google Apps Script in 2023. At that time, it just worked with Spotify's API to get one's music listening history. This was fine for me but eventually I wanted to get it out of the Google Apps Script world and make it easier to share with others. In this version, I reworked it to be able to get listening history from Tautulli (Plex).

The only two ticket APIs (currently) free and available ot use are Ticketmaster and Resident Advisor. Correct me if I'm wrong but I've looked for others. When I first wrote this in 2023, there were only a few other GitHub projects that demonstrated using Resident Advisor's GraphQL API but I had to do some graphQL-fu to figure out how to use it flexibly.

## About

### Features

- **Top Artists tracking:** from Tautulli, Spotify, both, or manual-only (no API fetching); ranks your top artists in short term, medium term, and long-term windows; optional scheduled auto-refresh
- **Custom list:** manually pin artists to always include
- **Ignore list:** exclude specific artists from top-artists and event search entirely (e.g. artists who are not alive, not touring, or you're just not going to see them live)
- **Event search:** Ticketmaster and/or Resident Advisor matched against your list of artists - schedule weekly event searches to update the list or start the search manually
- **Events UI:** Peruse the discovered events in card and list views, sortable columns, per-event delete/ignore
- **Notifications:**
  - weekly event digest email
  - Google Calendar sync, and a generic JSON webhook (e.g. Discord, Home Assistant) with a customizable template and per-channel test-send buttons
- **Settings UI:** every integration configured and auto-saved from one in-app tab, with per-section enable/disable and live connection status
- **Theming:** Grayscale and Catppuccin Mocha themes
- **Apps Script Webhook Handler Script** (optional) - If one wants to avoid the OAuth process with Google (requires HTTPS), I use this Google Apps Script webapp to handle sending a weekly email and adding calendar events

### Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Styling:** Tailwind CSS 4
- **Runtime:** Node 20, packaged as a Docker image
- **Storage:** flat JSON files on disk (no database) - settings, event store, artist lists, and caches, managed through a small file-store module with read/write locking
- **Auth:** OAuth flows for Spotify and Google, using popup windows for the consent step
- **External APIs:** Tautulli API, Spotify Web API, Ticketmaster Discovery API, Resident Advisor's public GraphQL API, Google Gmail/Calendar APIs - with a self-hosted Google Apps Script webhook offered as an OAuth-free alternative for email/calendar
- **Deployment:** Docker / Docker Compose, with instructions for Unraid as well

### Requirements

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
  - OAuth connection to Google (requires an HTTPS connection if redirect URI is anything other than `localhost`)
  - [Apps Script webhook script](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md) - set up as an alternative to OAuth.

## Installation

- [Docker Compose](https://github.com/cparsell/music-spider-service/blob/main/Setup-DockerCompose.md)
- [Unraid](https://github.com/cparsell/music-spider-service/blob/main/Setup-Unraid.md)

## Configuring the app

In the web UI, the settings live in the **Settings** tab and changes auto-save as you type. Sections are collapsible; only what you enable actually gets used (disabled sections make no API calls).

### Artists

Choose where your "top artists" list comes from, under **Artists > Artist Sources**:

- **Tautulli only** - pulls play counts from your Tautulli instance (Plex). Requires the Tautulli URL, an API key (Tautulli > Settings > Web Interface > API), and optionally a Music Section ID to limit it to one library (find it in Tautulli under Libraries > Music - it appears in the URL as `section_id=X`).
- **Spotify only** - pulls your Spotify top artists. Requires a Spotify app: go to the [Spotify Developer Dashboard](https://developer.spotify.com/), create an app, copy the Redirect URI shown in Music Spider's Spotify section into the app's settings, then paste the app's Client ID/Secret back into Music Spider and click **Connect Spotify Account**.
- **Both** - merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify fills in anything Tautulli didn't surface. Requires both sets of credentials above.

### Event Search

Pick one or both sources under **Event Search > Event Search Sources**:

- **Ticketmaster** -
  - `API Key` from [Ticketmaster Developer Dashboard](https://developer.ticketmaster.com/). Create an account then create an "app". **NOTE: Ticketmaster asks you to set a `Redirect URI` but it is unnecessary. You can set it to `http://127.0.0.1/` if required to get the API key**
  - `Lat/Long` of your area can be found at [latlong.net](https://www.latlong.net/)
  - `Radius` (in miles or km).
- **Resident Advisor** - no API key needed. Just open the **Resident Advisor** subsection and use the region search box to find and add your city/country - matching events near those regions are pulled automatically.

### Notifications

Configured under the **Notification** section, once events are found:

- **Email** and/or **Google Calendar** - enable "Send a weekly email digest" and/or "Add newly found events to Google Calendar" under **Google (Email & Calendar)**. Pick one of two ways to let Music Spider actually talk to Google:
  - **OAuth** - connects a Google account directly. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI shown in Music Spider as an authorized redirect URI. Enter the Client ID/Secret, then click **Connect Google Account**. This only works over HTTPS once you're accessing Music Spider from anywhere other than `127.0.0.1`/`localhost` - see [Google OAuth and HTTPS](#google-oauth-and-https) below.
  - **Apps Script Webhook** - send email/calendar actions through a small script you deploy yourself instead. No OAuth client, redirect URI, or HTTPS needed on Music Spider's end. See [Setting up the Apps Script webhook](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md).
- **Generic webhook** - enable "Send a weekly webhook digest" under **Webhook** and provide a URL that accepts an incoming POST (e.g. a Discord channel webhook, or a Home Assistant automation with a "Webhook" trigger). Customize the JSON body template using the `{{subject}}`, `{{summary}}`, and `{{count}}` placeholders - each is JSON-escaped automatically. Use the **Send Test Webhook** button to try it out.

Both the OAuth and Apps Script paths grant Music Spider send-only email access and calendar-event-creation access at most - never read/delete access to your existing mail or calendar. Review the source yourself before connecting either if you want to confirm that.

Use the **Send Test Email** / **Create Test Calendar Event** buttons in Music Spider's Settings to confirm it's wired up correctly.

### Google OAuth and HTTPS

If you choose the OAuth integration method (for Spotify or Google) and access Music Spider from anywhere other than `127.0.0.1`/`localhost` - e.g. a LAN IP, a hostname, or over the internet - **the redirect URI must be reachable at that same address, and Google in particular requires it to be HTTPS**. Put Music Spider behind a reverse proxy with TLS (e.g. Caddy, Traefik, SWAG, or your NAS's built-in reverse proxy) if you want OAuth working from anything other than the same machine.

The [Apps Script webhook script](https://github.com/cparsell/music-spider-service/blob/main/Setup-AppsScriptWebhookHandler.md) sidesteps this entirely for Google. It was set up as an alternative to the OAuth method - no HTTPS needed.

## License

[MIT](LICENSE)
