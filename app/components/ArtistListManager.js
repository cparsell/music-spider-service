"use client";
import { useState, useEffect } from "react";

export default function ArtistListManager({ apiPath, addLabel }) {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch(apiPath)
      .then((res) => res.json())
      .then((data) => setArtists(data.artists || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [apiPath]);

  const addArtist = async (e) => {
    e.preventDefault();
    setError("");
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
      setError(data.error || "Failed to add artist");
      return;
    }
    setArtists(data.artists);
    setInput("");
  };

  const removeArtist = async (name) => {
    const res = await fetch(apiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setArtists(data.artists);
  };

  return (
    <div>
      <form onSubmit={addArtist} className="flex gap-2 mb-4 items-start">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"Artist name, or paste a list (one per line)"}
          rows={3}
          className="border rounded px-2 py-1 flex-1 max-w-sm"
        />
        <button type="submit" className="px-3 py-1 rounded bg-black text-white">
          {addLabel}
        </button>
      </form>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : artists.length === 0 ? (
        <p className="text-gray-500">No artists yet.</p>
      ) : (
        <table className="w-full max-w-md border-collapse">
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
      )}
    </div>
  );
}
