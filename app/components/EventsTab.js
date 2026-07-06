"use client";
import { useState, useEffect } from "react";

function formatDate(dateValue) {
  const d = new Date(dateValue);
  return isNaN(d) ? String(dateValue) : d.toLocaleString();
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const loadEvents = () => {
    setLoading(true);
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .finally(() => setLoading(false));
  };

  useEffect(loadEvents, []);

  const runSearch = async () => {
    setSearching(true);
    setMessage("");
    try {
      const res = await fetch("/api/events/search", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setEvents(data.events || []);
      setMessage(
        `Searched ${data.artistsSearched} artists, found ${data.found} matching events.`,
      );
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSearching(false);
    }
  };

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={runSearch}
          disabled={searching}
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
        >
          {searching ? "Searching..." : "Run Search"}
        </button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : sortedEvents.length === 0 ? (
        <p className="text-gray-500">
          No events yet. Run a search to find some.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sortedEvents.map((event) => (
            <li key={event.id} className="flex gap-4 border rounded p-3">
              {event.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.image}
                  alt={event.eName}
                  className="w-24 h-24 object-cover rounded shrink-0"
                />
              )}
              <div>
                <p className="font-semibold">{event.eName}</p>
                <p className="text-sm text-gray-600">
                  {formatDate(event.date)}
                </p>
                <p className="text-sm text-gray-600">
                  {event.venue}
                  {event.city ? `, ${event.city}` : ""}
                </p>
                {event.address && (
                  <p className="text-xs text-gray-500">{event.address}</p>
                )}
                {event.acts?.length > 0 && (
                  <p className="text-sm mt-1">Acts: {event.acts.join(", ")}</p>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
