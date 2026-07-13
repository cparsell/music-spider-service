"use client";
import { useState, useEffect, useRef } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

function formatDate(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d)) return String(dateValue);
  const datePart = d.toLocaleDateString();
  // toLocaleTimeString gives e.g. "7:00 PM" / "7:30 PM" - drop the :00 for
  // on-the-hour times and the space before AM/PM for a compact "7PM" /
  // "7:30PM" on cards.
  const timePart = d
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(" ", "");
  return `${datePart}, ${timePart}`;
}

const COLUMNS = [
  { key: "eName", label: "Event" },
  { key: "venue", label: "Venue" },
  { key: "acts", label: "Acts" },
  { key: "date", label: "Date" },
];

function getSortValue(event, key) {
  switch (key) {
    case "eName":
      return (event.eName || "").toLowerCase();
    case "venue":
      return (event.venue || "").toLowerCase();
    case "acts":
      return (
        event.actsDisplay ||
        (event.acts || []).join(", ") ||
        ""
      ).toLowerCase();
    case "date": {
      const t = new Date(event.dates?.[0]?.date).getTime();
      return isNaN(t) ? Infinity : t;
    }
    default:
      return "";
  }
}

function buildSearchResultMessage(result) {
  const foundPhrase = `found ${result.found} matching events${
    result.newFound != null ? ` (${result.newFound} new)` : ""
  }`;
  let message = result.canceled
    ? `Search canceled. Searched ${result.artistsSearched} artists, ${foundPhrase} before stopping.`
    : `Searched ${result.artistsSearched} artists, ${foundPhrase}.`;
  if (result.calendarSynced > 0) {
    message += ` Added ${result.calendarSynced} to Google Calendar.`;
  }
  if (result.calendarError) {
    message += ` Calendar sync issue: ${result.calendarError}`;
  }
  return message;
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [progress, setProgress] = useState(null);
  // Remembered across reloads/tab switches (localStorage, not server state -
  // purely a per-browser display preference) so returning to this tab shows
  // whichever view was last used instead of always resetting to card view.
  // Starts as "card" (matching what the server renders with no access to
  // localStorage) and is corrected in an effect right after mount - reading
  // localStorage directly in the initializer would make the client's first
  // render disagree with the server-rendered HTML and produce a hydration
  // mismatch.
  const [viewMode, setViewMode] = useState("card");
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "asc",
  });
  // A search runs server-side independent of this component's lifecycle -
  // switching tabs unmounts it, but the search keeps going. These track the
  // poll loop and whether we've actually observed it running (vs. stale
  // leftover state from a previous search) across that remount.
  const pollRef = useRef(null);
  const sawRunningRef = useRef(false);

  const loadEvents = () => {
    setLoading(true);
    setStatusMessage("Loading events...");
    setStatusError(false);
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setStatusMessage(`Loaded ${data.events?.length || 0} events`);
        setStatusError(false);
      })
      .catch((err) => {
        setStatusMessage(err.message || "Failed to load events");
        setStatusError(true);
      })
      .finally(() => setLoading(false));
  };

  const applyRunningState = (data) => {
    if (data.phase) setStatusMessage(data.phase);
    setProgress(
      data.total > 0 ? { completed: data.completed, total: data.total } : null,
    );
  };

  // Refreshes just the events list, without loadEvents()'s own "Loading
  // events..."/"Loaded N events" status messages - those would otherwise
  // land asynchronously after (and clobber) the search-completion message
  // set alongside this call.
  const refreshEventsSilently = () => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => {});
  };

  // Polls the server's shared search-progress state (rather than relying on
  // one request's own response) so a search that was started, then this tab
  // was switched away and back to, still shows up correctly here.
  const watchProgress = () => {
    clearInterval(pollRef.current);
    setSearching(true);
    setStatusError(false);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/events/search/progress");
        const data = await res.json();

        if (data.running) {
          sawRunningRef.current = true;
          applyRunningState(data);
          return;
        }

        // Not running - but if we've never actually seen it running (e.g.
        // the request that was supposed to start it hasn't landed on the
        // server yet), keep waiting rather than mistaking leftover state
        // from a previous search for this one having finished instantly.
        if (!sawRunningRef.current) return;

        clearInterval(pollRef.current);
        sawRunningRef.current = false;
        setSearching(false);
        setProgress(null);
        refreshEventsSilently();
        if (data.result) {
          setStatusMessage(buildSearchResultMessage(data.result));
          setStatusError(!!data.result.calendarError);
        }
      } catch {
        // ignore transient poll errors, next tick will retry
      }
    }, 1000);
  };

  useEffect(() => {
    const storedViewMode = localStorage.getItem("eventsViewMode");
    if (storedViewMode) setViewMode(storedViewMode);

    loadEvents();

    // Pick up a search already in progress (e.g. started before this tab
    // was switched away and back) instead of showing a blank idle state
    // while it keeps running unseen server-side.
    fetch("/api/events/search/progress")
      .then((res) => res.json())
      .then((data) => {
        if (!data.running) return;
        sawRunningRef.current = true;
        applyRunningState(data);
        watchProgress();
      })
      .catch(() => {});

    return () => clearInterval(pollRef.current);
  }, []);

  const runSearch = () => {
    setStatusMessage("Starting search...");
    setStatusError(false);
    setProgress(null);
    watchProgress();

    fetch("/api/events/search", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Search failed");
        }
      })
      .catch((err) => {
        // Only reachable if the request never made it to/through the
        // server at all - once it's genuinely running, completion is
        // reported via watchProgress's poll instead.
        clearInterval(pollRef.current);
        sawRunningRef.current = false;
        setSearching(false);
        setProgress(null);
        setStatusMessage(err.message);
        setStatusError(true);
      });
  };

  const cancelSearch = async () => {
    setStatusMessage("Canceling search...");
    await fetch("/api/events/search/cancel", { method: "POST" });
  };

  const deleteEvent = async (id, { ignore = false } = {}) => {
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ignore }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Failed to delete event");
      setStatusError(true);
      return;
    }
    setEvents(data.events || []);
    setStatusMessage(ignore ? "Event deleted and ignored" : "Event deleted");
    setStatusError(false);
  };

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.dates?.[0]?.date) - new Date(b.dates?.[0]?.date),
  );

  const direction = sortConfig.direction === "asc" ? 1 : -1;
  const listEvents = [...events].sort((a, b) => {
    const av = getSortValue(a, sortConfig.key);
    const bv = getSortValue(b, sortConfig.key);
    if (av < bv) return -1 * direction;
    if (av > bv) return 1 * direction;
    return 0;
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("eventsViewMode", mode);
  };

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  return (
    <TabLayout
      controls={
        <div className="flex items-center gap-3 ">
          <button
            onClick={runSearch}
            disabled={searching}
            className="px-3 py-0.5 rounded-2xl bg-neutral-200 text-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {searching ? "Searching..." : "Run Search"}
          </button>
          {searching && (
            <button
              onClick={cancelSearch}
              className="px-3 py-1 rounded-2xl bg-red-300 text-white cursor-pointer"
            >
              Cancel
            </button>
          )}

          <div className="flex-1 flex justify-end">
            <div className="flex rounded-2xl overflow-hidden border border-neutral-500">
              {["card", "list"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSetViewMode(mode)}
                  className={`px-3 py-0.5 capitalize ${
                    viewMode === mode
                      ? "bg-neutral-700 text-white"
                      : "bg-neutral-200 text-neutral-900 cursor-pointer"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
      statusBar={
        <StatusBar
          message={statusMessage}
          error={statusError}
          progress={progress}
        />
      }
    >
      {!loading &&
        (sortedEvents.length === 0 ? (
          <p className="text-neutral-500">
            No events yet. Run a search to find some.
          </p>
        ) : viewMode === "list" ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-neutral-500 border-b">
                <th className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal"></th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal"
                  >
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-neutral-300"
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span>
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal">
                  Links
                </th>
                <th className="sticky top-0 z-10 bg-black py-1 font-normal">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {listEvents.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-neutral-700 last:border-0 align-top"
                >
                  <td className="py-2 pr-4">
                    {event.image && (
                      <img
                        src={event.image}
                        alt=""
                        className="w-33 rounded object-contain"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-4">{event.eName}</td>
                  <td className="py-2 pr-4">
                    {event.venue}
                    {event.address && (
                      <div className="text-xs text-neutral-500">
                        {event.address.trim()}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {event.actsDisplay || event.acts?.join(", ") || ""}
                  </td>
                  <td className="py-2 pr-4 text-sm">
                    <div className="flex flex-col gap-1 whitespace-nowrap">
                      {event.dates?.map((d) => (
                        <span key={d.date}>{formatDate(d.date)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-sm whitespace-nowrap">
                    <div className="flex flex-col gap-1 ">
                      {event.dates?.map((d) =>
                        d.urls?.map((u) => (
                          <a
                            key={u.name + d.date}
                            href={u.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {u.name}
                          </a>
                        )),
                      )}
                    </div>
                  </td>
                  <td className="py-2 ">
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-sm px-2 py-0.5  text-red-600 hover:underline"
                    >
                      delete
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id, { ignore: true })}
                      title="Delete and exclude from future searches"
                      className="text-sm px-2 py-0.5  text-red-600 hover:underline"
                    >
                      ignore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 overflow-auto pr-2 mt-2">
            {sortedEvents.map((event) => (
              <li
                key={event.id}
                className="relative aspect-6/8 rounded-xl overflow-hidden bg-neutral-800 text-shadow-lg hover:text-shadow-xlg shadow-black/50 "
              >
                {event.image &&
                  (event.dates?.[0]?.urls?.[0]?.url ? (
                    <a
                      href={event.dates[0].urls[0].url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0"
                    >
                      <img
                        src={event.image}
                        alt={event.eName || ""}
                        className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100"
                      />
                    </a>
                  ) : (
                    <img
                      src={event.image}
                      alt={event.eName || ""}
                      className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100"
                    />
                  ))}
                <div className="absolute inset-0 bg-linear-to-t from-black to-transparent to-70% pointer-events-none" />
                <div className="absolute z-10 bottom-2 right-2 flex flex-col items-end gap-1 text-shadow-lg">
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-xs text-red-200 hover:underline rounded-xl px-1.5 py-0.5 text-shadow-lg"
                  >
                    delete
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id, { ignore: true })}
                    title="Delete and exclude from future searches"
                    className="text-xs text-red-200 hover:underline rounded-xl px-1.5 py-0.5 text-shadow-lg"
                  >
                    ignore
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="font-semibold leading-tight">{event.eName}</p>
                  <p className="text-sm text-neutral-300">
                    {event.venue}
                    {/* {event.city ? `, ${event.city}` : ""} */}
                  </p>
                  {event.address && (
                    <p className="text-xs text-neutral-300">
                      {event.address.trim()}
                    </p>
                  )}
                  {event.actsDisplay && (
                    <p className="text-sm mt-1 text-white">
                      Acts: {event.actsDisplay}
                    </p>
                  )}
                  <div className="flex flex-col gap-1 mt-1">
                    {event.dates?.map((d) => (
                      <div key={d.date} className="flex gap-2 text-sm">
                        <span className="text-neutral-300 shrink-0">
                          {formatDate(d.date)}
                        </span>
                        <div className="flex flex-col">
                          {d.urls?.map((u) => (
                            <a
                              key={u.name}
                              href={u.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-300 hover:underline"
                            >
                              {u.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </TabLayout>
  );
}
