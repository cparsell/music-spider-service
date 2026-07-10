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

export default function HomeClient({ defaultTab, isConfigured }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return defaultTab;
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || defaultTab;
  });

  return (
    // Below lg: logo/tabs stacked above content. At lg+, there's enough room
    // to move logo/tabs into a left sidebar instead and let content use the
    // full remaining width, so each tab's scrollbar hugs the browser edge.
    <main className="h-screen overflow-hidden flex flex-col items-center lg:flex-row lg:items-stretch">
      <div className="w-full max-w-5xl shrink-0  pt-8 lg:w-56 lg:max-w-none lg:shrink-0 lg:flex lg:flex-col lg:border-r lg:border-neutral-800 lg:pl-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="imglogo"></span>
          <h1 className="text-2xl font-bold text-neutral-200">Music Spider</h1>
        </div>
        <div className="flex gap-1 mb-3 border-b-2 lg:flex-col lg:gap-0.5 lg:border-b-0  lg:mb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 -mb-0.5 border-b-2 lg:mb-0 lg:border-b-0 lg:border-l-2 lg:pl-3 lg:text-left ${
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

      <div className="w-full flex-1 min-h-0 px-3 pb-2 lg:max-w-none lg:px-6 lg:pt-8">
        <div className="h-full">
          {tab === "top" && (
            <TopArtistsTab
              description={
                isConfigured
                  ? "Top artists based on your listening history."
                  : "Top artists based on your listening history. Configure sources in settings."
              }
            />
          )}
          {tab === "custom" && (
            <ArtistListManager
              apiPath="/api/artists/manual"
              addLabel="Add"
              description="Manually add artists that should always be included in event search."
            />
          )}
          {tab === "ignored" && (
            <ArtistListManager
              apiPath="/api/artists/ignored"
              addLabel="Ignore"
              description="Artists in this list will be ignored when fetching events and top artist lists."
            />
          )}
          {tab === "events" && <EventsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </main>
  );
}
