"use client";
import { useState, useEffect } from "react";

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

export default function TopArtistsTab() {
  const [term, setTerm] = useState("medium_term");
  const [artists, setArtists] = useState([]);
  const [spotifyError, setSpotifyError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top-artists?term=${term}`)
      .then((res) => res.json())
      .then((data) => {
        setArtists(data.artists || []);
        setSpotifyError(data.spotifyError || "");
      })
      .finally(() => setLoading(false));
  }, [term]);

  const handleSave = async (name) => {
    try {
      await addArtist("/api/artists/manual", name);
      setStatus((s) => ({ ...s, [name]: "saved" }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnore = async (name) => {
    try {
      await addArtist("/api/artists/ignored", name);
      setStatus((s) => ({ ...s, [name]: "ignored" }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {["short_term", "medium_term", "long_term", "combined"].map((t) => (
          <button
            key={t}
            onClick={() => setTerm(t)}
            className={`px-3 py-1 rounded ${term === t ? "bg-black text-white" : "bg-gray-200"}`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>
      {spotifyError && (
        <p className="text-sm text-amber-700 mb-2">
          Spotify: {spotifyError}
        </p>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full max-w-2xl border-collapse">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b">
              <th className="py-1 pr-4 font-normal">#</th>
              <th className="py-1 pr-4 font-normal">Artist</th>
              <th className="py-1 pr-4 font-normal">Plays</th>
              <th className="py-1 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a, i) => (
              <tr key={a.artist} className="border-b last:border-0">
                <td className="py-1 pr-4 text-gray-400">{i + 1}</td>
                <td className="py-1 pr-4">{a.artist}</td>
                <td className="py-1 pr-4">{a.plays ?? "–"}</td>
                <td className="py-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(a.artist)}
                      disabled={status[a.artist] === "saved"}
                      className="text-sm px-2 py-0.5 rounded bg-green-100 text-green-800 disabled:opacity-50"
                    >
                      {status[a.artist] === "saved" ? "Saved" : "Save"}
                    </button>
                    <button
                      onClick={() => handleIgnore(a.artist)}
                      disabled={status[a.artist] === "ignored"}
                      className="text-sm px-2 py-0.5 rounded bg-red-100 text-red-800 disabled:opacity-50"
                    >
                      {status[a.artist] === "ignored" ? "Ignored" : "Ignore"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
