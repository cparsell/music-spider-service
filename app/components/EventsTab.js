"use client";
import { useState, useEffect, useRef } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

function formatDate(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d)) return String(dateValue);
  const datePart = new Intl.DateTimeFormat("en-US", {
    // timeZone: "America/Los_Angeles",
    // year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);

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

function CalendarButton({ eventId, date, calendarEventId, syncing, onClick }) {
  const added = !!calendarEventId;
  return (
    <button
      onClick={onClick}
      disabled={added || syncing}
      title={added ? "Already added to Calendar" : "Add to Calendar"}
      className={
        "shrink-0 text-neutral-200 disabled:opacity-40  cursor-pointer disabled:cursor-auto"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        {added && <path d="M8 14l2.5 2.5L16 11" />}
      </svg>
    </button>
  );
}

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

function renderActs(actsList, fallback) {
  if (!actsList?.items?.length) return fallback;
  return (
    <>
      {actsList.items.map((act, i) => (
        <span key={act.name + i}>
          {i > 0 && ", "}
          {act.known ? (
            <strong className="text-white">{act.name}</strong>
          ) : (
            act.name
          )}
        </span>
      ))}
      {actsList.truncated && "..."}
    </>
  );
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [progress, setProgress] = useState(null);
  // Remembered across reloads/tab switches (localStorage, not server state -
  // purely a per-browser display preference)
  const [viewMode, setViewMode] = useState("card");
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "asc",
  });
  const [syncingDates, setSyncingDates] = useState(() => new Set());
  const [calendarAvailable, setCalendarAvailable] = useState(false);

  // A search runs server-side independent of this component's lifecycle -
  // switching tabs unmounts it, but the search keeps going. These track the
  // poll loop and whether we've actually observed it running
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

  // Refreshes just the events list, without loadEvents()'s own
  // "Loading events..." / "Loaded N events" status messages
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

    // show up a search already in progress (e.g. started before this tab
    // was switched away and back)
    fetch("/api/events/search/progress")
      .then((res) => res.json())
      .then((data) => {
        if (!data.running) return;
        sawRunningRef.current = true;
        applyRunningState(data);
        watchProgress();
      })
      .catch(() => {});

    // check if Google Calendar is connected
    fetch("/api/google/status")
      .then((res) => res.json())
      .then((data) => {
        setCalendarAvailable(data.calendarAvailable);
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

  const addEventToCalendar = async (eventId, date) => {
    const key = `${eventId}:${date}`;
    setSyncingDates((prev) => new Set([...prev, date]));

    try {
      const res = await fetch(`/api/events/${eventId}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || "Failed to add to Calendar");
        setStatusError(true);
        return;
      }
      setEvents(data.events || []);
      setStatusMessage("Added to Google Calendar");
      setStatusError(false);
    } catch (err) {
      setStatusMessage(err.message || "Failed to add event to calendar");
      setStatusError(true);
    } finally {
      setSyncingDates((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
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
          // List view
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
                  <td className="py-2 pr-4 font-semibold">{event.eName}</td>
                  <td className="py-2 pr-4">
                    {event.venue}
                    {event.address && (
                      <div className="text-xs text-neutral-500">
                        {event.address.trim()}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {renderActs(
                      event.actsList,
                      event.actsDisplay || event.acts?.join(", ") || "",
                    )}
                  </td>
                  <td className="py-2 pr-4 text-sm">
                    <div className="flex flex-col gap-1 whitespace-nowrap">
                      {event.dates?.map((d) => (
                        <span
                          key={d.date}
                          className="flex items-center gap-1.5"
                        >
                          {formatDate(d.date)}
                          {calendarAvailable && (
                            <CalendarButton
                              eventId={event.id}
                              date={d.date}
                              calendarEventId={d.calendarEventId}
                              syncing={syncingDates.has(
                                `${event.id}:${d.date}`,
                              )}
                              onClick={() =>
                                addEventToCalendar(event.id, d.date)
                              }
                            />
                          )}
                        </span>
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
                  <td className="py-2 grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))]">
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-sm px-2 py-0.5  text-red-600 hover:underline cursor-pointer"
                    >
                      delete
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id, { ignore: true })}
                      title="Delete and exclude from future searches"
                      className="text-sm px-2 py-0.5  text-red-600 hover:underline cursor-pointer"
                    >
                      ignore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Card view
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 overflow-auto mt-5 pb-3">
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
                <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2 text-white">
                  <div className="min-w-0 flex-1">
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
                        {renderActs(event.actsList, event.actsDisplay)}
                      </p>
                    )}
                    <div className="flex flex-col gap-1 mt-1">
                      {event.dates?.map((d) => (
                        <div
                          key={d.date}
                          className="flex gap-2 text-sm items-center"
                        >
                          <span className="text-neutral-300 shrink-0 flex items-center gap-1.5">
                            {formatDate(d.date)}
                            {calendarAvailable && (
                              <CalendarButton
                                eventId={event.id}
                                date={d.date}
                                calendarEventId={d.calendarEventId}
                                syncing={syncingDates.has(
                                  `${event.id}:${d.date}`,
                                )}
                                onClick={() => addToCalendar(event.id, d.date)}
                              />
                            )}
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
                  <div className="shrink-0 flex flex-col items-end gap-1 text-shadow-lg">
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
                </div>
              </li>
            ))}
          </ul>
        ))}
    </TabLayout>
  );
}
