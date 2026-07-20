# Running it with Docker Compose

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose. The published image is [`139139/music-spider`](https://hub.docker.com/r/139139/music-spider) on Docker Hub.

## Option 1: Pull the published image (recommended)

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

## Option 2: Build from source

```bash
git clone <this-repo>
cd music-spider-service
docker compose up -d --build
```

This uses the `docker-compose.yml` already in the repo (`build: .`), so it builds the image locally instead of pulling it. Useful if you want to modify the code. To update after pulling new changes: `git pull && docker compose up -d --build`.

## After starting it

Open `http://<your-host>:6100` (e.g. `http://localhost:6100`, or the LAN IP of the machine running it) and head to the **Settings** tab to start configuring.

Settings and cached data are persisted to a `data/` directory so they survive container restarts/rebuilds/updates. Both options above mount this as `./data:/app/data` — adjust the left-hand side of that volume mapping if you'd rather point it somewhere else (e.g. an appdata share on a NAS).

---

[Back to README](https://github.com/cparsell/music-spider-service/blob/main/README.md)
