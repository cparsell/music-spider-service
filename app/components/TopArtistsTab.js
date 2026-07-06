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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top-artists?term=${term}&count=200`)
      .then((res) => res.json())
      .then((data) => setArtists(data.artists || []))
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
        {["short_term", "medium_term", "long_term"].map((t) => (
          <button
            key={t}
            onClick={() => setTerm(t)}
            className={`px-3 py-1 rounded ${term === t ? "bg-black text-white" : "bg-gray-200"}`}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {artists.map((a, i) => (
            <li key={i} className="flex items-center gap-2 py-1">
              <span>
                {i + 1}. {a.artist} ({a.plays} plays)
              </span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
