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
      setStatusMessage(
        data.canceled
          ? `Search canceled. Searched ${data.artistsSearched} artists, found ${data.found} matching events before stopping.`
          : `Searched ${data.artistsSearched} artists, found ${data.found} matching events.`,
      );
      setStatusError(false);
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
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={runSearch}
              disabled={searching}
              className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
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
            <button
              onClick={sendEmail}
              disabled={sendingEmail}
              className="px-3 py-1 rounded bg-neutral-700 text-white disabled:opacity-50"
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </button>
          </div>
          <StatusBar
            message={statusMessage}
            error={statusError}
            progress={progress}
          />
        </>
      }
    >
      {!loading &&
        (sortedEvents.length === 0 ? (
          <p className="text-gray-500">
            No events yet. Run a search to find some.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-4 overflow-auto">
            {sortedEvents.map((event) => (
              <li
                key={event.id}
                className="flex gap-4 border rounded p-3 flex-1 min-w-[320px] max-w-md"
              >
                <div className="flex flex-col justify-between shrink-0">
                  {event.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={event.image} target="_blank" rel="noreferrer">
                      <img
                        src={event.image}
                        alt={event.eName}
                        className="w-24 h-24 object-cover rounded"
                      />
                    </a>
                  )}
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-sm text-red-800 hover:underline"
                  >
                    delete
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{event.eName}</p>
                  <p className="text-sm text-gray-600">
                    {event.venue}
                    {event.city ? `, ${event.city}` : ""}
                  </p>
                  {event.address && (
                    <p className="text-xs text-gray-500">
                      {event.address.trim()}
                    </p>
                  )}
                  {event.actsDisplay && (
                    <p className="text-sm mt-1">Acts: {event.actsDisplay}</p>
                  )}
                  <div className="flex flex-col gap-1 mt-1">
                    {event.dates?.map((d) => (
                      <div key={d.date} className="flex gap-2 text-sm">
                        <span className="text-gray-600 shrink-0">
                          {formatDate(d.date)}
                        </span>
                        <div className="flex flex-col">
                          {d.urls?.map((u) => (
                            <a
                              key={u.name}
                              href={u.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
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
