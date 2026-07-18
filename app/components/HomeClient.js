"use client";
import { useState } from "react";
import TopArtistsTab from "./TopArtistsTab";
import ArtistListManager from "./ArtistListManager";
import EventsTab from "./EventsTab";
import SettingsTab from "./SettingsTab";

function CalendarIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect
        x="3"
        y="4"
        width="14"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6.5 2.5v3M13.5 2.5v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartBarIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M4 16V11M10 16V7M16 16V4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookmarkIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5 3h10a1 1 0 0 1 1 1v13l-6-3.5L4 17V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoSymbolIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5.5 5.5l9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CogIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.992l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.688 7.688 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

const TABS = [
  { id: "events", label: "Events", icon: CalendarIcon },
  { id: "top", label: "Top Artists", icon: ChartBarIcon },
  { id: "custom", label: "Custom List", icon: BookmarkIcon },
  { id: "ignored", label: "Ignore List", icon: NoSymbolIcon },
  { id: "settings", label: "Settings", icon: CogIcon },
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
    <main className="h-screen bg-neutral-800 overflow-hidden flex flex-col items-center lg:flex-row lg:items-stretch">
      <div className="w-full max-w-5xl shrink-0 pt-6 lg:w-56 lg:max-w-none lg:shrink-0 lg:flex lg:flex-col lg:border-r lg:border-neutral-500 lg:pl-2">
        <div className="gap-2 pb-3 mb-2 ml-2 mt-1 lg:pl-6 lg:mt-0 lg:ml-0">
          <a
            href="https://github.com/cparsell/music-spider-service"
            target="_blank"
            className="flex flex-row gap-0.5"
          >
            <h1 className=" text-logo  font-bold text-neutral-200">Music</h1>
            <span className="imglogo-slot ">
              <span className="imglogo "></span>
            </span>
            <h1 className=" text-logo sm:text-logo-small font-bold text-neutral-200 ">
              Spider
            </h1>
          </a>
        </div>
        <div className="flex gap-1 mb-0  border-neutral-200 border-b-2 bg-neutral-800 md:bg-neutral-800 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:mb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 -mb-0.5 border-b-2 lg:flex-none lg:justify-start lg:mb-0 lg:border-b-0 lg:pl-6 lg:text-left  ${
                  tab === t.id
                    ? "border-neutral-900 bg-neutral-200 text-neutral-900"
                    : "border-b-transparent border-r-neutral-800 border-r text-neutral-400 cursor-pointer "
                }`}
              >
                <Icon className="w-6 h-6 md:w-5 sm:h-5 shrink-0" />
                <span className="hidden md:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 px-3 lg:max-w-none lg:px-6 bg-black">
        <div className="h-full">
          {tab === "top" && (
            <TopArtistsTab
              description={
                isConfigured
                  ? "Top artists based on your listening history. Selecting term(s) below also sets which are combined into the artist list used for event searches."
                  : "Top artists based on your listening history. Selecting term(s) below also sets which are combined into the artist list used for event searches. Configure sources in the settings."
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
          {tab === "settings" && <SettingsTab isConfigured={isConfigured} />}
        </div>
      </div>
    </main>
  );
}
