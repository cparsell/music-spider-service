"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [term, setTerm] = useState("medium_term");
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top-artists?term=${term}&count=200`)
      .then((res) => {
        console.log("Fetched response:", res);
        return res.json();
      })
      .then((data) => setArtists(data.artists || []))
      .finally(() => setLoading(false));
  }, [term]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Top Artists</h1>
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
            <li key={i}>
              {i + 1}. {a.artist} ({a.plays} plays)
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
