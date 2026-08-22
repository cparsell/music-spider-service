import { readJsonFile, writeJsonFile, withLock } from "./jsonStore.js";

const CACHE_FILE = "ticketmaster-attraction-ids.json";

// Resolving an artist name to a Ticketmaster attraction ID is a fuzzy
// keyword search so re-check periodically rather than caching forever,
// in case an artist that didn't match before now has a Ticketmaster
// page, or their attraction ID changes.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Returns the cached attraction ID for an artist name, or:
 * - `undefined` if it has never been looked up (or the entry expired)
 * - `null` if it was looked up and no matching attraction was found
 * @param {string} artistName
 * @returns {Promise<string|null|undefined>}
 */
export async function getCachedAttractionId(artistName) {
  const cache = await readJsonFile(CACHE_FILE, {});
  const entry = cache[artistName];
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
  return entry.attractionId;
}

/**
 * @param {string} artistName
 * @param {string|null} attractionId pass null to cache a "no match found" result
 */
export async function setCachedAttractionId(artistName, attractionId) {
  return withLock(CACHE_FILE, async () => {
    const cache = await readJsonFile(CACHE_FILE, {});
    cache[artistName] = { attractionId, cachedAt: Date.now() };
    await writeJsonFile(CACHE_FILE, cache);
  });
}
