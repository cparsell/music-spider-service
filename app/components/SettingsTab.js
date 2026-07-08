"use client";
import { useState, useEffect, useRef } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

const ARTIST_SOURCES = [
  {
    value: "tautulli",
    label: "Tautulli only",
    description: "Your Plex play history, as tracked by Tautulli.",
  },
  {
    value: "spotify",
    label: "Spotify only",
    description:
      "Your Spotify top artists (requires connecting your account below).",
  },
  {
    value: "both",
    label: "Both",
    description:
      "Merges the two: Tautulli's real play counts win for any artist it knows about, and Spotify contributes any additional artists it surfaced that Tautulli didn't.",
  },
];

const EVENT_SEARCH_TERM_OPTIONS = [
  { value: "short_term", label: "Short term (~4 weeks)" },
  { value: "medium_term", label: "Medium term (~6 months)" },
  { value: "long_term", label: "Long term (all time)" },
];

const COMBINED_MODES = [
  {
    value: "weighted",
    label: "Weighted score",
    description:
      "Combines whichever selected 'terms lists' into one list, weighting recent plays more heavily than older ones while still including old favorites.",
  },
  {
    value: "union",
    label: "Union of top lists",
    description:
      "Takes the top artists from each individual window (seletected terms) and merges them into one deduplicated list.",
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
      {
        key: "tautulliMusicSectionId",
        label:
          "Music Section ID (optional, limits to a specific library - can be found in Tautulli's library settings. Tautulli > Libraries > Music, then it shows in the URL, e.g. .../library?section_id=X)",
        type: "text",
      },
    ],
  },
  {
    title: "Spotify",
    description:
      "To fetch Spotify listening history, go to the Spotify Developer Dashboard \(https://developer.spotify.com/), create up an application, and add the Redirect URI below. Save the Client ID and Client Secret below. Then press 'Connect'",
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
      {
        key: "units",
        label: "Units",
        type: "switch",
        options: [
          { value: "miles", label: "Miles" },
          { value: "km", label: "Kilometers" },
        ],
      },
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
    title: "Google (Email & Calendar)",
    description:
      'To send event emails and/or add events to Google Calendar, connect a Google account via OAuth: in the Google Cloud Console, create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI below as an authorized redirect URI. Enter the Client ID/Secret below, then click "Connect Google Account."',
    warning:
      'Connecting a Google account grants this app permission to send email as you (Gmail\'s "gmail.send" scope, send-only) and, if Calendar sync is enabled below, to create events on your calendar ("calendar.events" scope). Neither scope can read, delete, or otherwise access your existing mail or calendar. If you plan to use this feature, review this app\'s source code yourself to confirm there is no misuse of that access.',
    fields: [
      { key: "emailRecipient", label: "Recipient email", type: "text" },
      {
        key: "calendarId",
        label: "Calendar ID (blank = primary calendar)",
        type: "text",
      },
      { key: "googleClientId", label: "Google Client ID", type: "text" },
      {
        key: "googleClientSecret",
        label: "Google Client Secret",
        type: "password",
      },
      { key: "googleRedirectUri", label: "Google Redirect URI", type: "text" },
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
      window.history.replaceState(
        null,
        "",
        rest ? `?${rest}` : window.location.pathname,
      );
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
          eventUrl.hostname === "localhost" ||
          eventUrl.hostname === "127.0.0.1";
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

function GoogleConnection({ redirectUri, calendarSyncEnabled }) {
  const [status, setStatus] = useState(null); // { connected, scope }
  const [statusMessage, setStatusMessage] = useState("");

  const loadStatus = () => {
    fetch("/api/google/status")
      .then((res) => res.json())
      .then(setStatus);
  };

  useEffect(() => {
    loadStatus();

    const params = new URLSearchParams(window.location.search);
    const googleParam = params.get("google");
    if (googleParam) {
      setStatusMessage(googleParam);
      params.delete("google");
      params.delete("tab");
      const rest = params.toString();
      window.history.replaceState(
        null,
        "",
        rest ? `?${rest}` : window.location.pathname,
      );
    }

    const onMessage = (event) => {
      if (event.data?.source !== "google-oauth") return;
      // Same loopback-host caveat as the Spotify popup - see there for why.
      try {
        const eventUrl = new URL(event.origin);
        const isLoopback =
          eventUrl.hostname === "localhost" ||
          eventUrl.hostname === "127.0.0.1";
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
    await fetch("/api/google/status", { method: "DELETE" });
    setStatus({ connected: false, scope: "" });
  };

  const connect = () => {
    let base = "";
    try {
      base = new URL(redirectUri).origin;
    } catch {
      base = "";
    }
    window.open(`${base}/api/google`, "google-auth", "width=500,height=700");
  };

  const needsCalendarReauth =
    calendarSyncEnabled &&
    status?.connected &&
    !status.scope?.includes("calendar.events");

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {status === null ? null : status.connected ? (
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
              Connect Google Account
            </button>
          </>
        )}
        {statusMessage && (
          <span className="text-sm text-gray-600">({statusMessage})</span>
        )}
      </div>
      {needsCalendarReauth && (
        <div className="text-sm text-amber-800 flex items-center gap-2">
          <span>
            ⚠️ Calendar sync is enabled, but this connection doesn&apos;t have
            Calendar access yet.
          </span>
          <button
            type="button"
            onClick={connect}
            className="underline shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}

const SAVE_DEBOUNCE_MS = 600;

export default function SettingsTab() {
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | pending | saving | saved | error
  const skipNextSave = useRef(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setForm);
  }, []);

  // Auto-save: any change to `form` (text, radio, checkbox) is persisted a
  // short beat after the user stops changing things, instead of on every
  // keystroke or requiring a manual save button.
  useEffect(() => {
    if (!form) return;
    if (skipNextSave.current) {
      // Don't save immediately after the initial GET populates the form.
      skipNextSave.current = false;
      return;
    }

    setSaveState("pending");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to save settings");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [form]);

  const updateField = (key, value, type) => {
    setForm((f) => ({
      ...f,
      [key]: type === "number" ? Number(value) : value,
    }));
  };

  const toggleEventSearchTerm = (term, checked) => {
    setForm((f) => {
      const current = f.eventSearchTerms || [];
      if (checked) {
        return current.includes(term)
          ? f
          : { ...f, eventSearchTerms: [...current, term] };
      }
      const next = current.filter((t) => t !== term);
      if (next.length === 0) return f; // always keep at least one selected
      return { ...f, eventSearchTerms: next };
    });
  };

  if (!form) return <p>Loading...</p>;

  const statusText =
    saveState === "pending" || saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "All changes saved"
        : saveState === "error"
          ? "Failed to save changes"
          : "";

  return (
    <TabLayout
      statusBar={
        <StatusBar message={statusText} error={saveState === "error"} />
      }
    >
      <div className="flex flex-col gap-6 w-full pr-3">
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
          <h2 className="font-semibold mb-2">Event Search Artist Terms</h2>
          <p className="text-sm text-gray-600 mb-2">
            Which top-artists window(s) to pull from when building the artist
            list used for event searches. Selecting more than one combines them
            using the Combined Top Artists Mode below.
          </p>
          <div className="flex flex-col gap-2">
            {EVENT_SEARCH_TERM_OPTIONS.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.eventSearchTerms?.includes(t.value) ?? false}
                  onChange={(e) =>
                    toggleEventSearchTerm(t.value, e.target.checked)
                  }
                />
                {t.label}
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
                  onChange={() =>
                    updateField("combinedTopArtistsMode", m.value)
                  }
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
            {section.description && (
              <p className="text-sm text-gray-600 mb-2">
                {section.description}
              </p>
            )}
            {section.warning && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                ⚠️ {section.warning}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {section.fields.map((f) =>
                f.type === "switch" ? (
                  <div key={f.key} className="flex flex-col gap-1 text-sm">
                    {f.label}
                    <div className="flex gap-2">
                      {f.options.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => updateField(f.key, o.value)}
                          className={`px-3 py-1 rounded text-sm ${
                            form[f.key] === o.value
                              ? "bg-black text-white"
                              : "bg-gray-200"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label key={f.key} className="flex flex-col gap-1 text-sm">
                    {f.label}
                    <input
                      type={f.type}
                      value={form[f.key] ?? ""}
                      onChange={(e) =>
                        updateField(f.key, e.target.value, f.type)
                      }
                      className="border rounded px-2 py-1"
                    />
                  </label>
                ),
              )}
            </div>
            {section.title === "Top Artists" && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.topArtistsAutoRefreshEnabled}
                    onChange={(e) =>
                      updateField(
                        "topArtistsAutoRefreshEnabled",
                        e.target.checked,
                      )
                    }
                  />
                  Automatically refresh every
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.topArtistsAutoRefreshDays ?? 1}
                  onChange={(e) =>
                    updateField(
                      "topArtistsAutoRefreshDays",
                      e.target.value,
                      "number",
                    )
                  }
                  className="border rounded px-2 py-1 w-16"
                />
                <span>day(s)</span>
              </div>
            )}
            {section.title === "Spotify" && (
              <SpotifyConnection redirectUri={form.spotifyRedirectUri} />
            )}
            {section.title === "Google (Email & Calendar)" && (
              <>
                <GoogleConnection
                  redirectUri={form.googleRedirectUri}
                  calendarSyncEnabled={form.googleCalendarSyncEnabled}
                />
                <label className="flex items-center gap-2 text-sm mt-3">
                  <input
                    type="checkbox"
                    checked={form.weeklyEmailEnabled}
                    onChange={(e) =>
                      updateField("weeklyEmailEnabled", e.target.checked)
                    }
                  />
                  Send a weekly email digest of upcoming events
                </label>
                <label className="flex items-center gap-2 text-sm mt-1">
                  <input
                    type="checkbox"
                    checked={form.googleCalendarSyncEnabled}
                    onChange={(e) =>
                      updateField("googleCalendarSyncEnabled", e.target.checked)
                    }
                  />
                  Add newly found events to Google Calendar
                </label>
              </>
            )}
          </div>
        ))}
      </div>
    </TabLayout>
  );
}
