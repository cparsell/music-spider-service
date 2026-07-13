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
    async removeMany(names) {
      const cleanSet = new Set(
        (names || []).map((n) => n?.trim()).filter(Boolean),
      );
      return withLock(filename, async () => {
        const list = (await readJsonFile(filename, [])).filter(
          (a) => !cleanSet.has(a),
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

// The two lists are mutually exclusive - an artist shouldn't be able to sit
// on both at once (e.g. "Ignore" no longer removing a "Saved" custom entry
// left it lingering there while still correctly excluded from search, which
// was just a confusing dangling state). These wrap add/addMany to also pull
// the name off the other list.
export async function addManualArtist(name) {
  await ignoredArtists.remove(name);
  return manualArtists.add(name);
}

export async function addManualArtists(names) {
  await ignoredArtists.removeMany(names);
  return manualArtists.addMany(names);
}

export async function addIgnoredArtist(name) {
  await manualArtists.remove(name);
  return ignoredArtists.add(name);
}

export async function addIgnoredArtists(names) {
  await manualArtists.removeMany(names);
  return ignoredArtists.addMany(names);
}
