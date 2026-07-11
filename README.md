# Music Spider

Music Spider uses your listening history (Plex/Tautulli and/or Spotify) to gather your top artists - most listened to (short and long term), searches for upcoming events from those artists near you, and notifies you by email, Google Calendar, or a generic webhook.

Everything is configured after the container is running, from the **Settings** tab in the app itself — nothing needs to be set in code or env files to get started beyond what's covered below.

## Running it with Docker Compose

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose. The published image is [`139139/music-spider`](https://hub.docker.com/r/139139/music-spider) on Docker Hub.

### Option 1: Pull the published image (recommended)

No need to clone the repo — just save this as `docker-compose.yml` in an empty folder:

```yaml
services:
  music-spider:
    image: 139139/music-spider:latest
    ports:
      - "6100:6100"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Then start it:

```bash
docker compose up -d
```

To update to the latest published version later:

```bash
docker compose pull
docker compose up -d
```

### Option 2: Build from source

```bash
git clone <this-repo>
cd music-spider-service
docker compose up -d --build
```

This uses the `docker-compose.yml` already in the repo (`build: .`), so it builds the image locally instead of pulling it. Useful if you want to modify the code. To update after pulling new changes: `git pull && docker compose up -d --build`.

### After starting it

Open `http://<your-host>:6100` (e.g. `http://localhost:6100`, or the LAN IP of the machine running it) and head to the **Settings** tab to start configuring.

Settings and cached data are persisted to a `data/` directory so they survive container restarts/rebuilds/updates. Both options above mount this as `./data:/app/data` — adjust the left-hand side of that volume mapping if you'd rather point it somewhere else (e.g. an appdata share on a NAS).

## Running it on Unraid

Unraid's Docker UI doesn't run `docker compose` directly, so pick one of these:

### Option 1: Add Container with the published image (easiest)

1. In Unraid's **Docker** tab, click **Add Container**.
2. Set **Repository** to `139139/music-spider:latest`.
3. Add a port mapping: container port `6100` to whatever host port you want (`6100` is fine unless it's taken).
4. Add a path mapping: container path `/app/data` to an appdata path, e.g. `/mnt/user/appdata/music-spider-service`.
5. Set **WebUI** to `http://[IP]:[PORT]` (requires being in **Advanced View**, not **Basic View**)
6. Apply. The app will be reachable at `http://<unraid-ip>:<host-port>`.

### Option 2: Compose Manager plugin

1. Install **Compose Manager** from the Community Applications store (Apps tab), if you don't already have it.
2. Add a new stack using the `docker-compose.yml` from [Option 1 of the Docker Compose instructions above](#option-1-pull-the-published-image-recommended).
3. Change the volume line to use an Unraid appdata path, e.g. `/mnt/user/appdata/music-spider-service:/app/data`.
4. Bring the stack up. The app will be reachable at `http://<unraid-ip>:6100`.

### Unraid-specific gotchas

- **WebUI button**: if the container was added via **Add Container** (Option 1) or raw `docker run` rather than through an Unraid Community Applications template, the `[IP]:[PORT]` placeholder in the WebUI URL field doesn't get substituted — clicking the button opens a blank/blocked popup. Use the literal reachable address instead, e.g. `http://192.168.1.50:6100/`.
- **OAuth redirect URIs**: since Unraid is reached over your LAN rather than `127.0.0.1`, set the `Spotify Redirect URI` / `Google Redirect URI` fields in Music Spider (and the matching values registered in the Spotify/Google developer consoles) to Unraid's actual reachable address. Google's OAuth also requires HTTPS at that address once it's anything other than `127.0.0.1`/`localhost` — see [Google OAuth and HTTPS](#google-oauth-and-https) below.
- Give the Unraid box a reserved/static LAN IP in your router so the URLs above don't silently break if its address changes later.

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
  - **Apps Script Webhook** — send email/calendar actions through a small script you deploy yourself instead. No OAuth client, redirect URI, or HTTPS needed on Music Spider's end. See [Setting up the Apps Script webhook](#setting-up-the-apps-script-webhook) below.
- **Generic webhook** — enable "Send a weekly webhook digest" under **Webhook** and provide a URL that accepts an incoming POST (e.g. a Discord channel webhook, or a Home Assistant automation with a "Webhook" trigger). Customize the JSON body template using the `{{subject}}`, `{{summary}}`, and `{{count}}` placeholders — each is JSON-escaped automatically. Use the **Send Test Webhook** button to try it out.

Both the OAuth and Apps Script paths grant Music Spider send-only email access and calendar-event-creation access at most — never read/delete access to your existing mail or calendar. Review the source yourself before connecting either if you want to confirm that.

### Setting up the Apps Script webhook

This is the simpler of the two Google options — no Cloud project, OAuth client, or HTTPS required on Music Spider's end. The script runs under your own Google account and Google hosts the endpoint for you.

1. Go to [script.google.com](https://script.google.com), create a new project, and replace the default `Code.gs` contents with this repo's [`apps-script/Code.gs`](apps-script/Code.gs).
2. **Deploy > New deployment**, select type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Copy the resulting web app URL (ends in `/exec`) into Music Spider's Settings, under **Google (Email & Calendar) > Apps Script Webhook URL**, with **Apps Script Webhook** selected as the integration method.
4. **(Recommended) Set a shared secret** so a leaked or guessed webapp URL can't be used to send mail or create events on your behalf: in the Apps Script project, go to **Project Settings > Script Properties**, add a property named `SHARED_SECRET` with a value of your choosing, and enter that same value into Music Spider's **Apps Script Shared Secret** field. Leave both blank to skip this check.

If you ever edit the script afterward, redeploy via **Deploy > Manage deployments > edit (pencil icon) > New version** — otherwise the live URL keeps running the old code.

Use the **Send Test Email** / **Create Test Calendar Event** buttons in Music Spider's Settings to confirm it's wired up correctly.

### Google OAuth and HTTPS

If you choose the OAuth integration method (for Spotify or Google) and access Music Spider from anywhere other than `127.0.0.1`/`localhost` — e.g. a LAN IP, a hostname, or over the internet — the redirect URI must be reachable at that same address, and Google in particular requires it to be HTTPS. Put Music Spider behind a reverse proxy with TLS (e.g. Caddy, Traefik, or your NAS's built-in reverse proxy) if you want OAuth working from anything other than the same machine. The Apps Script webhook option sidesteps this entirely for Google.
