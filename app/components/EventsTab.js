"use client";
import { useState, useEffect } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

function formatDate(dateValue) {
  const d = new Date(dateValue);
  return isNaN(d) ? String(dateValue) : d.toLocaleString();
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [progress, setProgress] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

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

  useEffect(loadEvents, []);

  const runSearch = async () => {
    setSearching(true);
    setStatusMessage("Starting search...");
    setStatusError(false);
    setProgress(null);

    const pollProgress = setInterval(async () => {
      try {
        const res = await fetch("/api/events/search/progress");
        const data = await res.json();
        if (data.phase) setStatusMessage(data.phase);
        setProgress(
          data.total > 0
            ? { completed: data.completed, total: data.total }
            : null,
        );
      } catch {
        // ignore transient poll errors, next tick will retry
      }
    }, 1000);

    try {
      const res = await fetch("/api/events/search", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setEvents(data.events || []);
      let message = data.canceled
        ? `Search canceled. Searched ${data.artistsSearched} artists, found ${data.found} matching events before stopping.`
        : `Searched ${data.artistsSearched} artists, found ${data.found} matching events.`;
      if (data.calendarSynced > 0) {
        message += ` Added ${data.calendarSynced} to Google Calendar.`;
      }
      if (data.calendarError) {
        message += ` Calendar sync issue: ${data.calendarError}`;
      }
      setStatusMessage(message);
      setStatusError(!!data.calendarError);
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    } finally {
      clearInterval(pollProgress);
      setProgress(null);
      setSearching(false);
    }
  };

  const cancelSearch = async () => {
    setStatusMessage("Canceling search...");
    await fetch("/api/events/search/cancel", { method: "POST" });
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

  const deleteEvent = async (id) => {
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Failed to delete event");
      setStatusError(true);
      return;
    }
    setEvents(data.events || []);
    setStatusMessage("Event deleted");
    setStatusError(false);
  };

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.dates?.[0]?.date) - new Date(b.dates?.[0]?.date),
  );

  return (
    <TabLayout
      controls={
        <div className="flex items-center gap-3 ">
          <button
            onClick={runSearch}
            disabled={searching}
            className="px-3 py-1 rounded bg-neutral-700 text-white disabled:opacity-50"
          >
            {searching ? "Searching..." : "Run Search"}
          </button>
          {searching && (
            <button
              onClick={cancelSearch}
              className="px-3 py-1 rounded bg-red-300 text-white"
            >
              Cancel
            </button>
          )}
          <div className="">
            <button
              onClick={sendEmail}
              disabled={sendingEmail}
              className="px-3 py-1 rounded bg-neutral-700 text-white disabled:opacity-50"
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </button>
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
        ) : (
          <ul className="flex flex-wrap gap-4 overflow-auto pr-2 ">
            {sortedEvents.map((event) => (
              <li
                key={event.id}
                className="relative w-80 aspect-6/8 rounded-xl overflow-hidden bg-neutral-800 text-shadow-lg hover:text-shadow-xlg shadow-black/50 "
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/100 to-transparent to-70% pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{event.eName}</p>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-xs text-red-300 hover:underline shrink-0"
                    >
                      delete
                    </button>
                  </div>
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
