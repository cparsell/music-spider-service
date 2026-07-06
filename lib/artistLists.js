import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

function createArtistList(filename) {
  return {
    async getAll() {
      return readJsonFile(filename, []);
    },
    async add(name) {
      const clean = name?.trim();
      if (!clean) throw new Error("Artist name required");
      return withLock(filename, async () => {
        const list = await readJsonFile(filename, []);
        if (!list.includes(clean)) list.push(clean);
        await writeJsonFile(filename, list);
        return list;
      });
    },
    async addMany(names) {
      const clean = [...new Set((names || []).map((n) => n?.trim()).filter(Boolean))];
      if (clean.length === 0) throw new Error("Artist name required");
      return withLock(filename, async () => {
        const list = await readJsonFile(filename, []);
        for (const name of clean) {
          if (!list.includes(name)) list.push(name);
        }
        await writeJsonFile(filename, list);
        return list;
      });
    },
    async remove(name) {
      const clean = name?.trim();
      return withLock(filename, async () => {
        const list = (await readJsonFile(filename, [])).filter(
          (a) => a !== clean,
        );
        await writeJsonFile(filename, list);
        return list;
      });
    },
  };
}

// Artists the user has added by hand, in addition to whatever Tautulli surfaces.
export const manualArtists = createArtistList("manual-artists.json");

// Artists to exclude from searches (e.g. no longer living, so ticket
// searches for them would just be noise).
export const ignoredArtists = createArtistList("ignored-artists.json");
