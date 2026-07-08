"use client";
import { useState } from "react";
import TopArtistsTab from "./TopArtistsTab";
import ArtistListManager from "./ArtistListManager";
import EventsTab from "./EventsTab";
import SettingsTab from "./SettingsTab";

const TABS = [
  { id: "events", label: "Events" },
  { id: "top", label: "Top Artists" },
  { id: "custom", label: "Custom List" },
  { id: "ignored", label: "Ignore List" },
  { id: "settings", label: "Settings" },
];

export default function HomeClient({ defaultTab }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return defaultTab;
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || defaultTab;
  });

  return (
    <main className="h-screen overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl h-full flex flex-col px-3">
        <div className="shrink-0 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="imglogo"></span>
            <h1 className="text-2xl font-bold text-neutral-200">
              Music Spider
            </h1>
          </div>
          <div className="flex gap-1 mb-3 border-b-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 -mb-0.5 border-b-2 ${
                  tab === t.id
                    ? "border-neutral-900 font-semibold bg-neutral-200 text-neutral-900"
                    : "border-transparent text-neutral-500 "
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 pb-8">
          {tab === "top" && <TopArtistsTab />}
          {tab === "custom" && (
            <ArtistListManager
              apiPath="/api/artists/manual"
              addLabel="Add artist"
            />
          )}
          {tab === "ignored" && (
            <ArtistListManager
              apiPath="/api/artists/ignored"
              addLabel="Ignore artist"
            />
          )}
          {tab === "events" && <EventsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </main>
  );
}
