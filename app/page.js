"use client";
import { useState } from "react";
import TopArtistsTab from "./components/TopArtistsTab";
import ArtistListManager from "./components/ArtistListManager";
import EventsTab from "./components/EventsTab";
import SettingsTab from "./components/SettingsTab";

const TABS = [
  { id: "top", label: "Top Artists" },
  { id: "custom", label: "Custom Artists" },
  { id: "ignored", label: "Ignore List" },
  { id: "events", label: "Events" },
  { id: "settings", label: "Settings" },
];

export default function Home() {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "top";
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "top";
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Music Spider</h1>
      <div className="flex gap-2 mb-6 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === t.id
                ? "border-black font-semibold"
                : "border-transparent text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "top" && <TopArtistsTab />}
      {tab === "custom" && (
        <ArtistListManager apiPath="/api/artists/manual" addLabel="Add artist" />
      )}
      {tab === "ignored" && (
        <ArtistListManager apiPath="/api/artists/ignored" addLabel="Ignore artist" />
      )}
      {tab === "events" && <EventsTab />}
      {tab === "settings" && <SettingsTab />}
    </main>
  );
}
