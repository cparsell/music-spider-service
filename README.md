# Music Spider

Music Spider finds your most-listened-to artists from Plex (via Tautulli) and/or Spotify, cross-references that list against event search APIs to find upcoming shows near you, and notifies you by email, Google Calendar, or a generic webhook. It _only_ finds concerts of artists you listen to - never recommends something because you liked something else.

![Sidenotes Basics](https://github.com/cparsell/music-spider-service/blob/main/Screenshot-EventsTab.png)

I first programmed [Music Spider](https://github.com/cparsell/music-spider) in Google Apps Script in 2023. At that time, it only worked with Spotify's API to get one's music listening history. This was fine for me but eventually I wanted to get it out of the Google Apps Script world and make it easier to share with others. In this version, I reworked it to be able to get listening history from Plex through Tautulli. I hope to add the ability to pull listening history from other sources as well.

The only two ticket APIs (currently) free and available ot use are Ticketmaster and Resident Advisor. Correct me if I'm wrong but I've looked for others. When I first wrote this in 2023, there were only a few other GitHub projects that demonstrated using Resident Advisor's GraphQL API but I had to do some graphQL-fu to figure out how to use it flexibly.

## About

### Features

- **Top Artists tracking:** from Tautulli, Spotify, both, or manual-only (no API fetching); ranks your top artists in short term, medium term, and long-term windows; optional scheduled auto-refresh
- **Custom list:** manually pin artists to always include
- **Ignore list:** exclude specific artists from top-artists and event search entirely (e.g. artists who are not alive, not touring, or you're just not going to see them live)
- **Event search:** Ticketmaster and/or Resident Advisor matched against your list of artists - schedule weekly event searches to update the list or start the search manually
- **Events UI:** Peruse the discovered events in card and list views, sortable columns, per-event delete/ignore
- **Notifications:**
  - Weekly event digest email
  - Google Calendar sync - via a connected Google account (OAuth) or a GCP service account (no OAuth consent screen or HTTPS needed),
  - generic JSON webhook (e.g. Discord, Home Assistant)
- **Settings UI:**
- **Theming:** Grayscale and Catppuccin Mocha themes

### Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Styling:** Tailwind CSS 4
- **Runtime:** Node 20, packaged as a Docker image
- **Storage:** flat JSON files on disk (no database) - settings, event store, artist lists, and caches, managed through a small file-store module with read/write locking
- **Auth:** OAuth flows for Spotify and Google, using popup windows for the consent step
- **External APIs:** Tautulli API, Spotify Web API, Ticketmaster Discovery API, Resident Advisor's public GraphQL API, Google Gmail/Calendar APIs
- **Deployment:** Docker / Docker Compose, with instructions for Unraid as well

### Requirements

- Docker
- Artists Source Options:
  - Tautulli: API key needed (from Tautulli settings)
  - Spotify: API key from [developer.spotify.com](https://developer.spotify.com/)
- Event Search options:
  - Ticketmster: API key from [developer.ticketmaster.com](https://developer.ticketmaster.com/)
- Options for Notifications
  - SMTP email connection
  - Custom webhook - can be used to send event summary to Discord, Slack, etc.
  - OAuth connection to Google (requires an HTTPS connection if redirect URI is anything other than `localhost`)
  - GCP service account for Google Calendar ([setup](https://github.com/cparsell/music-spider-service/blob/main/Setup-GoogleCalendarAccess.md)) - calendar events only, but no OAuth client or HTTPS needed

## Installation

- [Docker Compose](https://github.com/cparsell/music-spider-service/blob/main/Setup-DockerCompose.md)
- [Unraid](https://github.com/cparsell/music-spider-service/blob/main/Setup-Unraid.md)

## Configuring the app

- [Configuration](https://github.com/cparsell/music-spider-service/blob/main/Setup-Configuration.md)

## License

[MIT](LICENSE)


