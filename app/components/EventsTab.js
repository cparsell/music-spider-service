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
    setStatusMessage("Searching Ticketmaster and Resident Advisor...");
    setStatusError(false);
    try {
      const res = await fetch("/api/events/search", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setEvents(data.events || []);
      setStatusMessage(
        `Searched ${data.artistsSearched} artists, found ${data.found} matching events.`,
      );
      setStatusError(false);
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    } finally {
      setSearching(false);
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
    (a, b) => new Date(a.date) - new Date(b.date),
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
          </div>
          <StatusBar message={statusMessage} error={statusError} />
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
                {event.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.image}
                    alt={event.eName}
                    className="w-24 h-24 object-cover rounded shrink-0"
                  />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{event.eName}</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(event.date)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {event.venue}
                    {event.city ? `, ${event.city}` : ""}
                  </p>
                  {event.address && (
                    <p className="text-xs text-gray-500">
                      {event.address.trim()}
                    </p>
                  )}
                  {event.acts?.length > 0 && (
                    <p className="text-sm mt-1">
                      Acts: {event.acts.join(", ")}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {event.urls?.map((u) => (
                      <a
                        key={u.name}
                        href={u.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {u.name}
                      </a>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-sm text-red-600 hover:underline self-start"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        ))}
    </TabLayout>
  );
}
