"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";
import { RA_REGIONS } from "@/lib/raRegions.js";

const RA_REGIONS_BY_ID = new Map(RA_REGIONS.map((r) => [r.id, r.label]));

const THEMES = [
  {
    value: "grayscale",
    label: "Grayscale",
    description: "The default black/white/gray look.",
  },
  {
    value: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    description: "Re-skins the same UI with the Catppuccin Mocha palette.",
  },
];

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

const EVENT_SEARCH_SOURCE_OPTIONS = [
  { value: "ticketmaster", label: "Ticketmaster" },
  { value: "resadvisor", label: "Resident Advisor" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const COMBINED_MODES = [
  {
    value: "weighted",
    label: "Weighted score",
    description:
      "Combines selected top artists lists (short term, long term, etc.) into one list, weighting recent plays more heavily than older ones while still including old favorites.",
  },
  {
    value: "union",
    label: "Union of top lists",
    description:
      "Takes the top artists from each individual window (selected terms) and merges them into one deduplicated list.",
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
        label: "Regions",
        type: "regionPicker",
      },
    ],
  },
  {
    title: "Google (Email & Calendar)",
    description:
      'Two ways to let Music Spider send event emails and/or add events to Google Calendar - pick one below. "OAuth" connects a Google account directly: in the Google Cloud Console, create/select a project, enable the Gmail API and/or Calendar API, then create an OAuth 2.0 Client ID (type: Web application) and add the Redirect URI below as an authorized redirect URI. Enter the Client ID/Secret below, then click "Connect Google Account." Note this requires an HTTPS connection to the redirect URI once accessed from anywhere other than 127.0.0.1/localhost. "Apps Script Webhook" instead sends requests to a small script you deploy yourself at script.google.com (see apps-script/Code.gs in the repo) - no OAuth client, redirect URI, or HTTPS needed on Music Spider\'s end, at the cost of maintaining that script.',
    warning:
      'Connecting a Google account via OAuth grants this app permission to send email as you (Gmail\'s "gmail.send" scope, send-only) and, if Calendar sync is enabled below, to create events on your calendar ("calendar.events" scope). Neither scope can read, delete, or otherwise access your existing mail or calendar. The Apps Script webhook option grants no such permissions to this app directly - instead your own script (which you control and can review) does the sending. Either way, if you plan to use this feature, review this app\'s source code yourself to confirm there is no misuse of that access.',
    fields: [
      { key: "emailRecipient", label: "Recipient email", type: "text" },
      {
        key: "calendarId",
        label: "Calendar ID (blank = primary calendar)",
        type: "text",
      },
      {
        key: "googleIntegrationMode",
        label: "Integration method",
        type: "switch",
        options: [
          { value: "oauth", label: "OAuth" },
          { value: "appsScript", label: "Apps Script Webhook" },
        ],
      },
      {
        key: "googleClientId",
        label: "Google Client ID",
        type: "text",
        showIf: (f) => f.googleIntegrationMode !== "appsScript",
      },
      {
        key: "googleClientSecret",
        label: "Google Client Secret",
        type: "password",
        showIf: (f) => f.googleIntegrationMode !== "appsScript",
      },
      {
        key: "googleRedirectUri",
        label: "Google Redirect URI",
        type: "text",
        showIf: (f) => f.googleIntegrationMode !== "appsScript",
      },
      {
        key: "appsScriptWebhookUrl",
        label: "Apps Script Webhook URL",
        type: "text",
        showIf: (f) => f.googleIntegrationMode === "appsScript",
      },
      {
        key: "appsScriptSharedSecret",
        label: "Apps Script Shared Secret (optional, recommended)",
        type: "password",
        showIf: (f) => f.googleIntegrationMode === "appsScript",
      },
    ],
  },
  {
    title: "Webhook",
    description:
      'Sends a weekly POST request with the JSON body defined below to any URL that accepts an incoming webhook - e.g. a Discord channel webhook, or a Home Assistant automation using a "Webhook" trigger (which accepts any JSON shape you send and lets you build the notification yourself from there). Use {{subject}}, {{summary}}, and {{count}} as placeholders - each is JSON-escaped automatically, so it\'s safe to drop inside a quoted string like "content": "{{summary}}". The result must be valid JSON once the placeholders are filled in. Note some services (e.g. Discord) cap message length around 2000 characters.',
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "text" },
      {
        key: "webhookTemplate",
        label: "Body template (JSON)",
        type: "textarea",
      },
    ],
  },
];

// Wraps a settings section in a bordered box with a clickable header.
// Collapsed, only the header (title + chevron) remains visible - the body
// stays mounted but is animated to zero height via a grid-rows transition
// (the standard trick for animating to/from an intrinsic height in CSS).
// Controlled by the parent (rather than managing its own open state) so
// only one of these top-level sections can be open at a time - see
// `openSection` below.
function SettingsSection({ title, open, onToggle, children }) {
  return (
    <div className="break-inside-avoid mb-6 border border-neutral-700 rounded-lg bg-neutral-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
      >
        <h2 className="font-bold text-neutral-200">{title}</h2>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`w-4 h-4 shrink-0 text-neutral-500 transition-transform duration-150 ${
            open ? "" : "-rotate-90"
          }`}
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Nested inside a SettingsSection - same idea (title + chevron, collapses to
// just the header) but lighter weight: no border box of its own, just a
// divider between subsections within the parent's body.
function SettingsSubsection({
  title,
  defaultOpen = true,
  children,
  disabled = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-neutral-700 first:border-t-0 pt-3 mt-3 first:mt-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <h3
          className={
            disabled
              ? "font-bold text-gray-600"
              : "font-bold text-base text-neutral-200"
          }
        >
          {title}
        </h3>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`w-3.5 h-3.5 shrink-0 text-neutral-500 transition-transform duration-150 ${
            open ? "" : "-rotate-90"
          }`}
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
      // The popup finishes on whatever host the Spotify redirect URI uses,
      // which may differ from the host this tab is on (e.g. this tab is on
      // a LAN hostname but the redirect URI is 127.0.0.1) even though it's
      // the same app - so compare against the configured redirect URI's
      // origin rather than assuming loopback.
      try {
        if (event.origin !== new URL(redirectUri).origin) return;
      } catch {
        return;
      }
      setStatusMessage(event.data.message);
      loadStatus();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [redirectUri]);

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
          <span className="text-sm text-neutral-500">Not connected</span>
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
        <span className="text-sm text-neutral-600">({statusMessage})</span>
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
      // Same redirect-URI-origin caveat as the Spotify popup - see there for
      // why.
      try {
        if (event.origin !== new URL(redirectUri).origin) return;
      } catch {
        return;
      }
      setStatusMessage(event.data.message);
      loadStatus();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [redirectUri]);

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
            <span className="text-sm text-neutral-500">Not connected</span>
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
          <span className="text-sm text-neutral-600">({statusMessage})</span>
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

function WebhookTest() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const sendTest = async () => {
    setSending(true);
    setMessage("Sending...");
    setError(false);
    try {
      const res = await fetch("/api/events/webhook", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send webhook");
      setMessage(`Sent with ${data.count} upcoming events.`);
      setError(false);
    } catch (err) {
      setMessage(err.message);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={sendTest}
        disabled={sending}
        className="text-sm px-2 py-0.5 rounded-2xl bg-neutral-300 text-neutral-800 disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send Test Webhook"}
      </button>
      {message && (
        <span
          className={`text-sm ${error ? "text-red-600" : "text-neutral-600"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}

function GoogleActionsTest() {
  const [busy, setBusy] = useState(""); // "" | "email" | "calendar"
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const run = async (kind, path, successMessage) => {
    setBusy(kind);
    setMessage("Sending...");
    setError(false);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessage(successMessage);
      setError(false);
    } catch (err) {
      setMessage(err.message);
      setError(true);
    } finally {
      setBusy("");
    }
  };

  const sendEmail = async () => {
    setSendingEmail(true);
    setStatusMessage("Sending email...");
    setStatusError(false);
    try {
      const res = await fetch("/api/events/email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setStatusMessage(`Email sent with ${data.count} upcoming events.`);
      setStatusError(false);
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div>
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() =>
            run("email", "/api/google/email/test", "Test email sent.")
          }
          disabled={!!busy}
          className="text-sm px-2 py-0.5 rounded-2xl bg-neutral-300 text-neutral-800 disabled:opacity-50 cursor-pointer"
        >
          {busy === "email" ? "Sending..." : "Send Test Email"}
        </button>
        <button
          type="button"
          onClick={() =>
            run(
              "calendar",
              "/api/google/calendar/test",
              "Test event created (tomorrow, same time) - delete it from your calendar when done.",
            )
          }
          disabled={!!busy}
          className="text-sm px-2 py-0.5 rounded-2xl bg-neutral-300 text-neutral-800 disabled:opacity-50 cursor-pointer"
        >
          {busy === "calendar" ? "Creating..." : "Create Test Calendar Event"}
        </button>

        <div className="">
          <button
            onClick={sendEmail}
            disabled={sendingEmail}
            className="px-2 py-0.5 text-sm rounded-2xl bg-neutral-300 text-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {sendingEmail ? "Sending..." : "Send Event Summary Email"}
          </button>
        </div>
      </div>
      {
        <div className="mt-2 mb-0">
          <span
            className={`text-sm ${error ? "text-red-600" : "text-neutral-500"}`}
          >
            {message}
          </span>
        </div>
      }
    </div>
  );
}

function RegionPicker({ value, onChange }) {
  const [search, setSearch] = useState("");

  const selectedIds = useMemo(
    () =>
      (value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => parseInt(s, 10)),
    [value],
  );

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return RA_REGIONS.filter(
      (r) =>
        !selectedIds.includes(r.id) && r.label.toLowerCase().includes(term),
    ).slice(0, 20);
  }, [search, selectedIds]);

  const addRegion = (id) => {
    onChange([...selectedIds, id].join(","));
    setSearch("");
  };

  const removeRegion = (id) => {
    onChange(selectedIds.filter((existing) => existing !== id).join(","));
  };

  return (
    <div className="flex flex-col gap-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 bg-neutral-700 rounded px-2 py-1 text-sm"
            >
              {RA_REGIONS_BY_ID.get(id) || `Unknown region (${id})`}
              <button
                type="button"
                onClick={() => removeRegion(id)}
                className="text-neutral-300 hover:text-red-600"
                aria-label={`Remove ${RA_REGIONS_BY_ID.get(id) || id}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a city or country to add..."
          className="border border-neutral-400 rounded px-2 py-1 text-sm w-full"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto border border-neutral-600 rounded bg-white shadow">
            {matches.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addRegion(r.id)}
                  className="w-full text-left px-2 py-1 text-sm bg-neutral-700 text-neutral-200 hover:bg-neutral-300 hover:text-neutral-800"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const SAVE_DEBOUNCE_MS = 600;

export default function SettingsTab() {
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | pending | saving | saved | error
  // Which top-level SettingsSection (by title) is currently open - null when
  // all are collapsed. Only one at a time, accordion-style.
  const [openSection, setOpenSection] = useState(null);
  const toggleSection = (title) =>
    setOpenSection((current) => (current === title ? null : title));
  const skipNextSave = useRef(true);
  const debounceRef = useRef(null);
  const pendingSaveRef = useRef(false);
  const formRef = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setForm);
  }, []);

  const saveNow = async () => {
    pendingSaveRef.current = false;
    setSaveState("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formRef.current),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

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
    pendingSaveRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(saveNow, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [form]);

  // The cleanup above cancels the debounce timer on every re-run, which also
  // fires on unmount (e.g. switching tabs) - without this, a save still
  // waiting out its debounce window gets silently dropped instead of ever
  // reaching settings.json. Flush it immediately here instead.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(debounceRef.current);
        saveNow();
      }
    };
  }, []);

  // Apply the theme to the document immediately on change, rather than
  // waiting for the debounced save + a full page reload (layout.js only
  // sets data-theme on first server render).
  useEffect(() => {
    if (form?.theme) document.documentElement.dataset.theme = form.theme;
  }, [form?.theme]);

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

  const toggleEventSearchSource = (source, checked) => {
    setForm((f) => {
      const current = f.eventSearchSources || [];
      if (checked) {
        return current.includes(source)
          ? f
          : { ...f, eventSearchSources: [...current, source] };
      }
      const next = current.filter((s) => s !== source);
      if (next.length === 0) return f; // always keep at least one selected
      return { ...f, eventSearchSources: next };
    });
  };

  if (!form) return <p>Loading...</p>;

  const sectionByTitle = Object.fromEntries(
    SECTIONS.map((section) => [section.title, section]),
  );

  // Renders a SECTIONS entry's description/warning/fields, plus whatever
  // extra section-specific controls (connection status, test buttons,
  // schedule pickers) follow it - shared by every field-driven subsection
  // below so that logic only lives in one place. `disabled` grays the whole
  // thing out and blocks interaction (e.g. the Tautulli section when
  // Spotify is the exclusively-selected artist source) without having to
  // thread a `disabled` prop through every distinct field/control type.
  const renderSectionFields = (section, disabled = false) => (
    <div
      className={disabled ? "opacity-40 pointer-events-none" : undefined}
      aria-disabled={disabled}
    >
      {section.description && (
        <p className="text-sm text-neutral-500 mb-2">{section.description}</p>
      )}
      {section.warning && (
        <p className="text-sm text-amber-200   border border-amber-200 rounded p-2 mb-3">
          ⚠️ {section.warning}
        </p>
      )}
      <div className="flex flex-col gap-3 ">
        {section.fields
          .filter((f) => (f.showIf ? f.showIf(form) : true))
          .map((f) =>
            f.type === "regionPicker" ? (
              <div key={f.key} className="flex flex-col gap-1 text-sm">
                {f.label}
                <RegionPicker
                  value={form[f.key]}
                  onChange={(v) => updateField(f.key, v)}
                />
              </div>
            ) : f.type === "switch" ? (
              <div key={f.key} className="flex flex-col gap-1 text-sm">
                {f.label}
                <div className="flex rounded-2xl overflow-hidden border border-neutral-300 w-fit">
                  {f.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => updateField(f.key, o.value)}
                      className={`px-3 py-0.5 ${
                        form[f.key] === o.value
                          ? "bg-neutral-700 text-white"
                          : "bg-neutral-300 text-neutral-900 cursor-pointer"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : f.type === "textarea" ? (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                {f.label}
                <textarea
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  rows={5}
                  className="border border-neutral-400 rounded px-2 py-1 font-mono text-xs"
                />
              </label>
            ) : (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                {f.label}
                <input
                  type={f.type}
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value, f.type)}
                  className="border border-neutral-400 rounded px-2 py-1"
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
                updateField("topArtistsAutoRefreshEnabled", e.target.checked)
              }
            />
            Automatically refresh every
          </label>
          <input
            type="number"
            min="1"
            value={form.topArtistsAutoRefreshDays ?? 1}
            onChange={(e) =>
              updateField("topArtistsAutoRefreshDays", e.target.value, "number")
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
          {form.googleIntegrationMode === "appsScript" ? (
            <GoogleActionsTest />
          ) : (
            <GoogleConnection
              redirectUri={form.googleRedirectUri}
              calendarSyncEnabled={form.googleCalendarSyncEnabled}
            />
          )}
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
          {form.weeklyEmailEnabled && (
            <div className="flex items-center gap-2 mt-2 ml-6 text-sm text-neutral-200">
              <span>Every</span>
              <select
                value={form.weeklyEmailDayOfWeek ?? 1}
                onChange={(e) =>
                  updateField("weeklyEmailDayOfWeek", e.target.value, "number")
                }
                className="border border-neutral-600 rounded px-2 py-1 text-neutral-100"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <span>at</span>
              <input
                type="time"
                value={form.weeklyEmailTimeOfDay ?? "09:00"}
                onChange={(e) =>
                  updateField("weeklyEmailTimeOfDay", e.target.value)
                }
                className="border border-neutral-600 rounded px-2 py-1 text-neutral-100"
              />
            </div>
          )}
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
          {form.googleIntegrationMode !== "appsScript" && <GoogleActionsTest />}
        </>
      )}
      {section.title === "Webhook" && (
        <>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="checkbox"
              checked={form.webhookEnabled}
              onChange={(e) => updateField("webhookEnabled", e.target.checked)}
            />
            Send a weekly webhook digest of upcoming events
          </label>
          <WebhookTest />
        </>
      )}
    </div>
  );

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
      <div className="columns-1 mt-6 pl-2 pr-6 gap-12 w-full lg:w-3xl max-w-[1800px]">
        <SettingsSection
          title="Appearance"
          open={openSection === "Appearance"}
          onToggle={() => toggleSection("Appearance")}
        >
          <div className="flex flex-col gap-3">
            {THEMES.map((t) => (
              <label
                key={t.value}
                className="flex items-start gap-3 border border-neutral-700 rounded p-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="theme"
                  checked={form.theme === t.value}
                  onChange={() => updateField("theme", t.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-sm text-neutral-500">{t.description}</p>
                </div>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="Artists"
          open={openSection === "Artists"}
          onToggle={() => toggleSection("Artists")}
        >
          <SettingsSubsection title="Artist Sources">
            <div className="flex flex-col gap-3">
              {ARTIST_SOURCES.map((s) => (
                <label
                  key={s.value}
                  className="flex items-start gap-3 border border-neutral-700 rounded p-3 cursor-pointer"
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
                    <p className="text-sm text-neutral-500">{s.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </SettingsSubsection>

          <SettingsSubsection title="Top Artists">
            {renderSectionFields(sectionByTitle["Top Artists"])}
          </SettingsSubsection>

          <SettingsSubsection title="Event Search Artist Terms">
            <p className="text-sm text-neutral-500 mb-2">
              Which top-artists window(s) to pull from when building the artist
              list used for event searches. Selecting more than one combines
              them using the Top Artist Combination Mode below.
            </p>
            <div className="flex flex-col gap-2">
              {EVENT_SEARCH_TERM_OPTIONS.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2 text-sm"
                >
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
          </SettingsSubsection>

          <SettingsSubsection title="Top Artist Combination Mode">
            <div className="flex flex-col gap-3">
              {COMBINED_MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex items-start gap-3 border border-neutral-700 rounded p-3 cursor-pointer"
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
                    <p className="text-sm text-neutral-500">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </SettingsSubsection>

          <SettingsSubsection
            title="Tautulli"
            disabled={form.artistSource === "spotify"}
          >
            {renderSectionFields(
              sectionByTitle["Tautulli"],
              form.artistSource === "spotify",
            )}
          </SettingsSubsection>

          <SettingsSubsection
            title="Spotify"
            disabled={form.artistSource === "tautulli"}
          >
            {renderSectionFields(
              sectionByTitle["Spotify"],
              form.artistSource === "tautulli",
            )}
          </SettingsSubsection>
        </SettingsSection>

        <SettingsSection
          title="Event Search"
          open={openSection === "Event Search"}
          onToggle={() => toggleSection("Event Search")}
        >
          <SettingsSubsection title="Event Search Sources">
            <p className="text-sm text-neutral-500 mb-2">
              Which APIs to query when running an event search. Disabling one
              skips it entirely (no API calls made) rather than just hiding its
              results.
            </p>
            <div className="flex flex-col gap-2">
              {EVENT_SEARCH_SOURCE_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={
                      form.eventSearchSources?.includes(s.value) ?? false
                    }
                    onChange={(e) =>
                      toggleEventSearchSource(s.value, e.target.checked)
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.eventSearchAutoRefreshEnabled}
                  onChange={(e) =>
                    updateField(
                      "eventSearchAutoRefreshEnabled",
                      e.target.checked,
                    )
                  }
                />
                Automatically search every
              </label>
              <input
                type="number"
                min="1"
                value={form.eventSearchAutoRefreshDays ?? 7}
                onChange={(e) =>
                  updateField(
                    "eventSearchAutoRefreshDays",
                    e.target.value,
                    "number",
                  )
                }
                className="border rounded px-2 py-1 w-16"
              />
              <span>day(s)</span>
            </div>
          </SettingsSubsection>

          <SettingsSubsection
            title="Ticketmaster"
            disabled={!(form.eventSearchSources || []).includes("ticketmaster")}
          >
            {renderSectionFields(
              sectionByTitle["Ticketmaster"],
              !(form.eventSearchSources || []).includes("ticketmaster"),
            )}
          </SettingsSubsection>

          <SettingsSubsection
            title="Resident Advisor"
            disabled={!(form.eventSearchSources || []).includes("resadvisor")}
          >
            {renderSectionFields(
              sectionByTitle["Resident Advisor"],
              !(form.eventSearchSources || []).includes("resadvisor"),
            )}
          </SettingsSubsection>
        </SettingsSection>

        <SettingsSection
          title="Notification"
          open={openSection === "Notification"}
          onToggle={() => toggleSection("Notification")}
        >
          <SettingsSubsection title="Google (Email & Calendar)">
            {renderSectionFields(sectionByTitle["Google (Email & Calendar)"])}
          </SettingsSubsection>

          <SettingsSubsection title="Webhook">
            {renderSectionFields(sectionByTitle["Webhook"])}
          </SettingsSubsection>
        </SettingsSection>
      </div>
    </TabLayout>
  );
}
