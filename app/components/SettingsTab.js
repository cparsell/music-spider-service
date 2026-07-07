"use client";
import { useState, useEffect } from "react";

const ARTIST_SOURCES = [
  {
    value: "tautulli",
    label: "Tautulli only",
    description: "Your Plex play history, as tracked by Tautulli.",
  },
  {
    value: "spotify",
    label: "Spotify only",
    description: "Your Spotify top artists (requires connecting your account below).",
  },
  {
    value: "both",
    label: "Both",
    description:
      "Merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify contributes any additional artists it surfaced that Tautulli didn't.",
  },
];

const COMBINED_MODES = [
  {
    value: "weighted",
    label: "Weighted score",
    description:
      "Combines all three windows into one score per artist, weighting recent plays more heavily than older ones.",
  },
  {
    value: "union",
    label: "Union of top lists",
    description:
      "Takes the top artists from each individual window (short/medium/long term) and merges them into one deduplicated list.",
  },
];

const SECTIONS = [
  {
    title: "Top Artists",
    fields: [
      {
        key: "maxTopArtistsCount",
        label: "Max number of top artists",
        type: "number",
      },
    ],
  },
  {
    title: "Tautulli",
    fields: [
      { key: "tautulliUrl", label: "URL", type: "text" },
      { key: "tautulliApiKey", label: "API Key", type: "password" },
      { key: "tautulliMusicSectionId", label: "Music Section ID", type: "text" },
    ],
  },
  {
    title: "Spotify",
    fields: [
      { key: "spotifyClientId", label: "Client ID", type: "text" },
      { key: "spotifyClientSecret", label: "Client Secret", type: "password" },
      { key: "spotifyRedirectUri", label: "Redirect URI", type: "text" },
    ],
  },
  {
    title: "Ticketmaster",
    fields: [
      { key: "ticketmasterApiKey", label: "API Key", type: "password" },
      { key: "latLong", label: "Lat/Long", type: "text" },
      { key: "radius", label: "Radius", type: "text" },
      { key: "units", label: "Units (miles/km)", type: "text" },
    ],
  },
  {
    title: "Resident Advisor",
    fields: [
      {
        key: "raRegion",
        label: "Region ID(s), comma-separated",
        type: "text",
      },
    ],
  },
  {
    title: "NextAuth (future feature)",
    fields: [
      { key: "nextAuthSecret", label: "Secret", type: "password" },
      { key: "nextAuthUrl", label: "URL", type: "text" },
    ],
  },
  {
    title: "Email & Calendar (future feature)",
    fields: [
      { key: "emailRecipient", label: "Email recipient", type: "text" },
      { key: "calendarId", label: "Calendar ID", type: "text" },
    ],
  },
];

function SpotifyConnection({ redirectUri }) {
  const [connected, setConnected] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const loadStatus = () => {
    fetch("/api/spotify/status")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected));
  };

  useEffect(() => {
    loadStatus();

    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get("spotify");
    if (spotifyParam) {
      setStatusMessage(spotifyParam);
      params.delete("spotify");
      params.delete("tab");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `?${rest}` : window.location.pathname);
    }

    const onMessage = (event) => {
      if (event.data?.source !== "spotify-oauth") return;
      // The popup finishes on whatever host the Spotify redirect URI uses
      // (e.g. 127.0.0.1), which may differ from the host this tab is on
      // (e.g. localhost) even though it's the same machine/port - so we
      // can't require an exact origin match here, just that it's loopback.
      try {
        const eventUrl = new URL(event.origin);
        const isLoopback =
          eventUrl.hostname === "localhost" || eventUrl.hostname === "127.0.0.1";
        if (!isLoopback || eventUrl.port !== window.location.port) return;
      } catch {
        return;
      }
      setStatusMessage(event.data.message);
      loadStatus();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const disconnect = async () => {
    await fetch("/api/spotify/status", { method: "DELETE" });
    setConnected(false);
  };

  const connect = () => {
    // Start the popup on the same host the redirect URI uses (e.g.
    // 127.0.0.1) rather than inheriting this tab's host (e.g. localhost) -
    // otherwise the state cookie gets set on the wrong host and never makes
    // it back on the callback request.
    let base = "";
    try {
      base = new URL(redirectUri).origin;
    } catch {
      base = "";
    }
    window.open(`${base}/api/spotify`, "spotify-auth", "width=500,height=700");
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      {connected === null ? null : connected ? (
        <>
          <span className="text-sm text-green-700">Connected</span>
          <button
            type="button"
            onClick={disconnect}
            className="text-sm text-red-600 hover:underline"
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-500">Not connected</span>
          <button
            type="button"
            onClick={connect}
            className="text-sm px-2 py-0.5 rounded bg-green-600 text-white"
          >
            Connect Spotify Account
          </button>
        </>
      )}
      {statusMessage && (
        <span className="text-sm text-gray-600">({statusMessage})</span>
      )}
    </div>
  );
}

export default function SettingsTab() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setForm);
  }, []);

  const updateField = (key, value, type) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: type === "number" ? Number(value) : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(await res.json());
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <p>Loading...</p>;

  return (
    <form onSubmit={save} className="flex flex-col gap-6 max-w-lg">
      <div>
        <h2 className="font-semibold mb-2">Artist Source</h2>
        <div className="flex flex-col gap-3">
          {ARTIST_SOURCES.map((s) => (
            <label
              key={s.value}
              className="flex items-start gap-3 border rounded p-3 cursor-pointer"
            >
              <input
                type="radio"
                name="artistSource"
                checked={form.artistSource === s.value}
                onChange={() => updateField("artistSource", s.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-sm text-gray-600">{s.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Combined Top Artists Mode</h2>
        <div className="flex flex-col gap-3">
          {COMBINED_MODES.map((m) => (
            <label
              key={m.value}
              className="flex items-start gap-3 border rounded p-3 cursor-pointer"
            >
              <input
                type="radio"
                name="combinedTopArtistsMode"
                checked={form.combinedTopArtistsMode === m.value}
                onChange={() => updateField("combinedTopArtistsMode", m.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium">{m.label}</p>
                <p className="text-sm text-gray-600">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="font-semibold mb-2">{section.title}</h2>
          <div className="flex flex-col gap-2">
            {section.fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                {f.label}
                <input
                  type={f.type}
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value, f.type)}
                  className="border rounded px-2 py-1"
                />
              </label>
            ))}
          </div>
          {section.title === "Spotify" && (
            <SpotifyConnection redirectUri={form.spotifyRedirectUri} />
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-50 self-start"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </div>
    </form>
  );
}
