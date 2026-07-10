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
    // Below lg (1024px, same as max-w-5xl below): logo/tabs stacked above
    // content, both capped at max-w-5xl, matching the layout this always
    // had. At lg+, there's enough room to move logo/tabs into a left
    // sidebar instead and let content use the freed-up width - fully, for
    // Events (so cards can fill the screen), capped at max-w-5xl (same as
    // before) for everything else so those tabs don't just end up with a
    // lot of empty space stretched across a wide screen.
    <main className="h-screen overflow-hidden flex flex-col items-center lg:flex-row lg:items-stretch">
      <div className="w-full max-w-5xl shrink-0 px-3 pt-8 lg:w-56 lg:max-w-none lg:shrink-0 lg:flex lg:flex-col lg:border-r lg:border-neutral-800 lg:px-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="imglogo"></span>
          <h1 className="text-2xl font-bold text-neutral-200">
            Music Spider
          </h1>
        </div>
        <div className="flex gap-1 mb-3 border-b-2 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:mb-0">
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

      <div className="w-full max-w-5xl flex-1 min-h-0 px-3 pb-8 lg:max-w-none lg:px-6 lg:pt-8">
        <div className={`h-full ${tab === "events" ? "" : "lg:max-w-5xl"}`}>
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
