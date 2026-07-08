import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const CACHE_FILE = "top-artists-cache.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Returns the cached result for a term ("short_term" | "medium_term" |
 * "long_term" | "combined"), or null if there's no entry or it's older
 * than a day.
 */
export async function getCachedTermResult(term) {
  const cache = await readJsonFile(CACHE_FILE, {});
  const entry = cache[term];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry;
}

export async function setCachedTermResult(term, data) {
  return withLock(CACHE_FILE, async () => {
    const cache = await readJsonFile(CACHE_FILE, {});
    cache[term] = { ...data, cachedAt: Date.now() };
    await writeJsonFile(CACHE_FILE, cache);
    return cache[term];
  });
}
