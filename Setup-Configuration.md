# Configuration

In the web UI, the settings live in the **Settings** tab and changes auto-save as you type.

## Artists

Choose where your "top artists" list comes from, under **Artists > Artist Sources**:

- **Tautulli only** - pulls play counts from your Tautulli instance (Plex). Requires the Tautulli URL, an API key (Tautulli > Settings > Web Interface > API), and optionally a Music Section ID to limit it to one library (find it in Tautulli under Libraries > Music - it appears in the URL as `section_id=X`).
- **Spotify only** - pulls your Spotify top artists. Requires a Spotify app: go to the [Spotify Developer Dashboard](https://developer.spotify.com/), create an app, copy the Redirect URI shown in Music Spider's Spotify section into the app's settings, then paste the app's Client ID back into Music Spider and click **Connect Spotify Account**. Uses OAuth with PKCE, so no Client Secret is needed.
- **Both** - merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify fills in anything Tautulli didn't surface. Requires both sets of credentials above.

### Top Artists configuration

**Top Artists** tab, you can see the list of artists fetched. The list is some combination of three ingredients:

- Long term (all time)
- Medium term (last 6 months)
- Short term (last 4 weeks)

In the same **Top Artists** tab, you can select which of these you want included in the search. The displayed list will immediately reflect your selection.

### Combination

How these are combined is influenced by the **Combination Mode** in **Settings** > **Artists** > **Artist Sources**.

**Combination Modes**:

- **Weighted Mode** (Default): Combines selected top artists lists (short term, long term, etc.) into one list, weighting recent plays more heavily than older ones while still including old favorites.
- **Union of top lists**: Takes the top artists from each individual window (selected terms) and merges them into one deduplicated list.

## Event Search

Pick one or both sources under **Event Search > Event Search Sources**:

- **Ticketmaster**:
  - `Consumer Key` from [Ticketmaster Developer Dashboard](https://developer.ticketmaster.com/). Create an account then create an "app" - use the `Consumer Key` it gives you (not the `Consumer Secret`, which isn't needed for the Discovery API this app uses). **NOTE: Ticketmaster asks you to set a `Redirect URI` but it is unnecessary. You can set it to `http://127.0.0.1/` if required to get the key**
  - `Lat/Long` of your area can be found at [latlong.net](https://www.latlong.net/). Add more than one location by putting each on its own line.
  - `Radius` (in miles or km) - applies to every location.
- **Resident Advisor**: no API key needed. Just open the **Resident Advisor** subsection and use the region search box to find and add your city/country - matching events near those regions are pulled automatically. More than one region can be added.

## Notifications

Configured under the **Notification** section, once events are found:

- **SMTP**: Send email notification using SMTP connection
- **Generic webhook**: enable "Send a weekly webhook digest" under **Webhook** and provide a URL that accepts an incoming POST (e.g. a Discord channel webhook, or a Home Assistant automation with a "Webhook" trigger). Customize the JSON body template using the `{{subject}}`, `{{summary}}`, and `{{count}}` placeholders - each is JSON-escaped automatically. Use the **Send Test Webhook** button to try it out.
- **Google Email**: Use Google API to send a weekly email digest of events. See [Connecting to Google]
- **Google Calendar**: If checked, "Add newly found events to Google Calendar" will sync all new events to the specified calendar. If unchecked, these can be added individually (manually).
- **Google Calendar (Service Account)**: Calendar-only alternative to connecting your own Google account - see [Using a service account for Calendar](#using-a-service-account-for-calendar) below.

### Connecting to Google

Let Music Spider talk to Google (for Email and/or Calendar) by connecting a Google account directly via **OAuth**: in the [Google Cloud Console](https://console.cloud.google.com/), create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI shown in Music Spider as an authorized redirect URI. Enter the Client ID/Secret, then click **Connect Google Account**. This only works over HTTPS once you're accessing Music Spider from anywhere other than `127.0.0.1`/`localhost` - see [Google OAuth and HTTPS](#google-oauth-and-https) below.

This grants Music Spider send-only email access and calendar-event-creation access at most - never read/delete access to your existing mail or calendar. Review the source yourself before connecting if you want to confirm that.

Use the **Send Test Email** / **Create Test Calendar Event** buttons in Music Spider's Settings to confirm it's wired up correctly.

### Using a service account for Google Calendar

If you only want calendar events (not email), a **GCP service account** is the simplest option - no consent screen, no redirect URI, and no HTTPS needed. You create a service account in the Google Cloud Console, download its JSON key, and share the calendar you want with the service account's email address. Music Spider signs in as that account directly.

Configure it under **Notification → Google Calendar (Service Account)**: check **Use a service account for Google Calendar events**, paste the JSON key (or a path to the key file on disk, if you'd rather mount it into the container), and enter the **Calendar ID** of the calendar you shared. Then use **Verify Calendar Access** and **Create Test Calendar Event** to confirm it works. Full walkthrough: [Giving Music Spider access to a Google Calendar](https://github.com/cparsell/music-spider-service/blob/main/Setup-GoogleCalendarAccess.md).

Caveats worth knowing:

- It covers **calendar events only** - email still needs SMTP or OAuth, since a service account can't send Gmail without domain-wide delegation.
- The Calendar ID is required. A blank/`primary` calendar would write to the service account's own hidden calendar rather than yours, so Music Spider refuses instead.
- While enabled, it takes precedence over the OAuth method for calendar events.
- Music Spider only requests the `calendar.events` scope, so the account can only touch calendars you've explicitly shared with it.

## Google OAuth and HTTPS

If you use OAuth (for Spotify or Google) and access Music Spider from anywhere other than `127.0.0.1`/`localhost` - e.g. a LAN IP, a hostname, or over the internet - **the redirect URI must be reachable at that same address, and Google in particular requires it to be HTTPS**. Put Music Spider behind a reverse proxy with TLS (e.g. Caddy, Traefik, SWAG, or your NAS's built-in reverse proxy) if you want OAuth working from anything other than the same machine.

A GCP service account (see [above](#using-a-service-account-for-google-calendar)) sidesteps this entirely for Calendar, with no HTTPS needed.

---

[Back to README](https://github.com/cparsell/music-spider-service/blob/main/README.md)
