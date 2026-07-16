# Running it on Unraid

## Add Container with the published image (easiest)

1. In Unraid's **Docker** tab, click **Add Container**.
2. Use the following settings (set to **Advanced View**, not **Basic View**):

- **Repository**: `139139/music-spider:latest`.
- **Icon URL**: `https://raw.githubusercontent.com/cparsell/music-spider-service/refs/heads/main/app/ms-logo-string-ico2-01.png`
- **WebUI**: `http://[IP]:[PORT]`

- **Port mapping:** container port `6100` to whatever host port you want (`6100` is fine unless it's taken).
- **Path mapping:** container path `/app/data` to an appdata path, e.g. `/mnt/user/appdata/music-spider-service`.

3. _Apply_. The app will be reachable at `http://<unraid-ip>:<host-port>`.

## Unraid-specific Notes

- **OAuth redirect URIs**: since Unraid is reached over your LAN rather than `127.0.0.1`, set the `Spotify Redirect URI` / `Google Redirect URI` fields in Music Spider (and the matching values registered in the Spotify/Google developer consoles) to Unraid's actual reachable address. Google's OAuth also requires HTTPS at that address once it's anything other than `127.0.0.1`/`localhost` — see [Google OAuth and HTTPS](#google-oauth-and-https) below.
- Give the Unraid box a reserved/static LAN IP in your router so the URLs above don't silently break if its address changes later.
