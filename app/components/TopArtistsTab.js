"use client";
import { useState, useEffect } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

async function addArtist(apiPath, name) {
  const res = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add artist");
  }
}

function formatCacheAge(cachedAt) {
  if (!cachedAt) return "";
  const minutes = Math.round((Date.now() - cachedAt) / 60000);
  if (minutes < 1) return " (just refreshed)";
  if (minutes < 60) return ` (cached ${minutes}m ago)`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ` (cached ${hours}h ago)`;
  return ` (cached ${Math.round(hours / 24)}d ago)`;
}

export default function TopArtistsTab({ description }) {
  const [term, setTerm] = useState("medium_term");
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);

  const loadArtists = () => {
    setLoading(true);
    setStatusMessage("Loading top artists...");
    setStatusError(false);
    return fetch(`/api/top-artists?term=${term}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setArtists([]);
          setStatusMessage(data.error);
          setStatusError(true);
          return;
        }
        setArtists(data.artists || []);
        const age = formatCacheAge(data.cachedAt);
        if (data.spotifyError) {
          setStatusMessage(`Spotify: ${data.spotifyError}`);
          setStatusError(true);
        } else {
          setStatusMessage(`Loaded ${data.artists?.length || 0} artists${age}`);
          setStatusError(false);
        }
      })
      .catch((err) => {
        setArtists([]);
        setStatusMessage(err.message || "Failed to load top artists");
        setStatusError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArtists();
  }, [term]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatusMessage("Refreshing all top artist lists...");
    setStatusError(false);
    try {
      const res = await fetch("/api/top-artists/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      await loadArtists();
      if (data.errors) {
        setStatusMessage(
          `Refreshed with some issues: ${Object.values(data.errors).join("; ")}`,
        );
        setStatusError(true);
      }
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async (name) => {
    try {
      await addArtist("/api/artists/manual", name);
      setStatus((s) => ({ ...s, [name]: "saved" }));
      setStatusMessage(`Saved ${name} to custom artists`);
      setStatusError(false);
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    }
  };

  const handleIgnore = async (name) => {
    try {
      await addArtist("/api/artists/ignored", name);
      setStatus((s) => ({ ...s, [name]: "ignored" }));
      setStatusMessage(`Added ${name} to ignore list`);
      setStatusError(false);
    } catch (err) {
      setStatusMessage(err.message);
      setStatusError(true);
    }
  };

  const handleUnignore = async (name) => {
    const res = await fetch("/api/artists/ignored", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Failed to remove from ignore list");
      setStatusError(true);
      return;
    }
    setStatus((s) => ({ ...s, [name]: "unignored" }));
    setStatusMessage(`Removed ${name} from ignore list`);
    setStatusError(false);
  };

  let rank = 0;
  const rankedArtists = artists.map((a) => {
    const ignored =
      status[a.artist] === "unignored"
        ? false
        : a.ignored || status[a.artist] === "ignored";
    return { ...a, ignored, rank: ignored ? null : ++rank };
  });

  return (
    <TabLayout
      description={description}
      controls={
        <div className="flex gap-2">
          {["short_term", "medium_term", "long_term", "combined"].map((t) => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              className={`px-3 py-0.5 rounded-2xl ${
                term === t
                  ? "bg-neutral-800 text-neutral-300 border border-neutral-500"
                  : "bg-neutral-200 text-neutral-900 cursor-pointer "
              }`}
            >
              {t.replace("_", " ").charAt(0).toUpperCase() +
                t.replace("_", " ").slice(1)}
            </button>
          ))}
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-0.5 rounded-2xl bg-neutral-200 text-neutral-800 disabled:opacity-50 cursor-pointer"
            >
              {refreshing ? "Refreshing..." : "Force Refresh"}
            </button>
          </div>
        </div>
      }
      statusBar={<StatusBar message={statusMessage} error={statusError} />}
    >
      {!loading && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-sm text-neutral-500">
              <th className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal border-b border-neutral-700">
                #
              </th>
              <th className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal border-b border-neutral-700">
                Artist
              </th>
              <th className="sticky top-0 z-10 bg-black py-1 pr-4 font-normal border-b border-neutral-700">
                Plays
              </th>
              <th className="sticky top-0 z-10 bg-black py-1 font-normal border-b border-neutral-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rankedArtists.map((a) => (
              <tr
                key={a.artist}
                className={`border-b last:border-0 ${a.ignored ? "text-neutral-500" : "text-neutral-200"}`}
              >
                <td className="py-1 pr-4 text-neutral-400">{a.rank ?? "–"}</td>
                <td className="py-1 pr-4">{a.artist}</td>
                <td className="py-1 pr-4">{a.plays ?? "–"}</td>
                <td className="py-1">
                  {a.ignored ? (
                    <button
                      onClick={() => handleUnignore(a.artist)}
                      className="text-sm px-2 py-0.5 rounded text-neutral-300 hover:underline"
                    >
                      Unignore
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(a.artist)}
                        disabled={status[a.artist] === "saved"}
                        className="text-sm px-2 py-0.5 rounded  text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {status[a.artist] === "saved" ? "Saved" : "Save"}
                      </button>
                      <button
                        onClick={() => handleIgnore(a.artist)}
                        className="text-sm px-2 py-0.5 rounded text-red-600 hover:underline"
                      >
                        Ignore
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TabLayout>
  );
}
