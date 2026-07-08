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
    <main className="h-screen overflow-hidden flex flex-col items-center">
      <div className="w-full max-w-5xl h-full flex flex-col px-8">
        <div className="shrink-0 pt-8">
          <div className="flex items-center gap-4 mb-4">
            <img
              id="imglogo"
              src="https://i.postimg.cc/xjv4nbBV/music-spider-logo-nobg.png"
              height="5%"
              width="5%"
            />
            <h1 className="text-2xl font-bold">Music Spider</h1>
          </div>
          <div className="flex gap-2 mb-6 border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 -mb-px border-b-2 ${
                  tab === t.id
                    ? "border-black font-semibold bg-neutral-200 text-neutral-800"
                    : "border-transparent text-neutral-500"
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
