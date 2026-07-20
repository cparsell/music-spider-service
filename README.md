# Music Spider

Music Spider is a self-hosted tool for turning your listening history into a concert-discovery tool. It pulls your top artists from Plex (via Tautulli) and/or Spotify, cross-references that list against event search APIs to find upcoming shows near you, and notifies you by email, Google Calendar, or a generic webhook.

![Sidenotes Basics](https://github.com/cparsell/music-spider-service/blob/main/Screenshot-EventsTab.png)

I first programmed [Music Spider](https://github.com/cparsell/music-spider) in Google Apps Script in 2023. At that time, it just worked with Spotify's API to get one's music listening history. This was fine for me but eventually I wanted to get it out of the Google Apps Script world and make it easier to share with others. In this version, I reworked it to be able to get listening history from Plex through Tautulli. I hope to add the ability to pull listening history from other sources as well.

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
  - Webhook (for Discord, Slack, Home Assistant, etc.)
- **Settings UI:**
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

- [Configuration](https://github.com/cparsell/music-spider-service/blob/main/Setup-Configuration.md)

## License

[MIT](LICENSE)
