"use client";
import { useState, useEffect } from "react";
import StatusBar from "./StatusBar";
import TabLayout from "./TabLayout";

export default function ArtistListManager({ apiPath, addLabel }) {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState(false);

  const load = () => {
    setLoading(true);
    setStatusMessage("Loading...");
    setStatusError(false);
    fetch(apiPath)
      .then((res) => res.json())
      .then((data) => {
        setArtists(data.artists || []);
        setStatusMessage(`Loaded ${data.artists?.length || 0} artists`);
        setStatusError(false);
      })
      .catch((err) => {
        setStatusMessage(err.message || "Failed to load artists");
        setStatusError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [apiPath]);

  const addArtist = async (e) => {
    e.preventDefault();
    const names = input
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        names.length === 1 ? { name: names[0] } : { names },
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Failed to add artist");
      setStatusError(true);
      return;
    }
    setArtists(data.artists);
    setInput("");
    setStatusMessage(
      names.length === 1 ? `Added ${names[0]}` : `Added ${names.length} artists`,
    );
    setStatusError(false);
  };

  const removeArtist = async (name) => {
    const res = await fetch(apiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Failed to remove artist");
      setStatusError(true);
      return;
    }
    setArtists(data.artists);
    setStatusMessage(`Removed ${name}`);
    setStatusError(false);
  };

  return (
    <TabLayout
      controls={
        <>
          <form onSubmit={addArtist} className="flex gap-2 mb-4 items-start">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={"Artist name, or paste a list (one per line)"}
              rows={3}
              className="border rounded px-2 py-1 flex-1 max-w-sm"
            />
            <div className="flex flex-col items-start gap-1">
              <button type="submit" className="px-3 py-1 rounded bg-black text-white">
                {addLabel}
              </button>
              <span className="text-xs text-gray-500">⌘+Enter / Ctrl+Enter</span>
            </div>
          </form>
          <StatusBar message={statusMessage} error={statusError} />
        </>
      }
    >
      {!loading &&
        (artists.length === 0 ? (
          <p className="text-gray-500">No artists yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {artists.map((name) => (
                <tr key={name} className="border-b last:border-0">
                  <td className="py-1 pr-4">{name}</td>
                  <td className="py-1">
                    <button
                      onClick={() => removeArtist(name)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </TabLayout>
  );
}
