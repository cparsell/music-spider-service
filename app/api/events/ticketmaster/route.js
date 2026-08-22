import {
  sleep,
  chunkArray,
  arrayRemoveDupes,
  stringSimilarity,
} from "@/lib/common.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { isCancelRequested } from "@/lib/searchProgress.js";
import {
  getCachedAttractionId,
  setCachedAttractionId,
} from "@/lib/attractionIdCache.js";

const TICKETMASTER_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";
const ATTRACTIONS_URL =
  "https://app.ticketmaster.com/discovery/v2/attractions.json";

// How many resolved attraction IDs to pack into a single events.json
// request's `attractionId=id1,id2,...` list. Keeps the query well under
// Ticketmaster's ~1000-result deep-paging ceiling (size * page) for any one
// request, while still collapsing hundreds of artists into a handful of calls.
const ATTRACTION_IDS_PER_REQUEST = 25;
// A batched search returns way more events per request than a single-artist
// keyword search did, so page in bigger chunks (500 is Ticketmaster's max).
const EVENT_PAGE_SIZE = 200;
// How confident an attraction-search result's name has to be (via
// stringSimilarity) to accept it as a match when there's no exact name hit.
const ATTRACTION_MATCH_THRESHOLD = 0.9;

// Event cards render at a tall aspect-6/8 with object-cover, first drop
// anything below a minimum resolution, then prefer whichever remaining
// image's aspect ratio is closest to the card's.
const MIN_IMAGE_WIDTH = 600;
const TARGET_RATIO = 6 / 8;

/**
 * Ticketmaster's `latlong` param wants "lat,long" with no space. Users type
 * this all sorts of ways (comma, space, slash, semicolon, pipe, tab...), so
 * just pull out the two numbers and reassemble them in the format the API
 * expects, whatever separator was used.
 * @param {string} raw
 * @returns {string}
 */
const normalizeLatLong = (raw) => {
  if (!raw) return raw;
  const numbers = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return raw.trim();
  return `${numbers[0]},${numbers[1]}`;
};

/**
 * Splits the (possibly multi-location) latLong setting into individual
 * "lat,long" pairs, one per line - each location is searched independently,
 * the same way multiple Resident Advisor regions are. Newline is the
 * separator *between* locations; normalizeLatLong still handles whatever
 * separator was used *within* a single pair (comma, space, slash, etc).
 * @param {string} raw
 * @returns {string[]}
 */
const parseLatLongList = (raw) => {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => normalizeLatLong(line.trim()))
    .filter(Boolean);
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Search Ticketmaster for every artist in artistsArr, across every
 * configured location.
 *
 * Ticketmaster's `keyword` param only takes one string, so per-artist
 * keyword search used to mean one request per artist. Its `attractionId`
 * param, though, takes a comma-separated list and ORs them together - so
 * artists are first resolved to their Ticketmaster attraction ID (cached to
 * disk in lib/attractionIdCache.js, since an artist's ID never changes) and
 * then searched in batches of many artists per request. Any artist that
 * can't be resolved to an attraction ID falls back to the old per-keyword
 * search, so nothing is silently dropped.
 * Any events returned that contain the artist's name are added to the results
 * API Docs: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/
 * API Explorer: https://developer.ticketmaster.com/api-explorer/v2/
 * Reference: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#search-events-v2
 * @param {array} artistsArr
 * @param {(completed: number, total: number) => void} [onProgress] called as each artist is resolved to an attraction ID
 * @returns {array} matched events, shaped for lib/eventsStore.js
 */
export const searchTMLoop = async (artistsArr, onProgress) => {
  const resolved = await getResolvedConfig();
  const apiKey = resolved.ticketmasterApiKey;
  const radius = resolved.radius;
  const units = resolved.units;
  const locations = parseLatLongList(resolved.latLong);
  const latlongList = locations.length > 0 ? locations : [""];

  let results = [];
  try {
    const resolvedAttractionIds = [];
    const unresolvedArtists = [];
    for (let i = 0; i < artistsArr.length; i++) {
      if (isCancelRequested()) break;
      const name = artistsArr[i];
      let attractionId = await getCachedAttractionId(name);
      if (attractionId === undefined) {
        attractionId = await resolveAttractionId(name, apiKey);
        await setCachedAttractionId(name, attractionId);
        await sleep(180);
      }
      if (attractionId) resolvedAttractionIds.push(attractionId);
      else unresolvedArtists.push(name);
      onProgress?.(i + 1, artistsArr.length);
    }

    const attractionIdChunks = chunkArray(
      arrayRemoveDupes(resolvedAttractionIds),
      ATTRACTION_IDS_PER_REQUEST,
    );

    for (const latlong of latlongList) {
      if (isCancelRequested()) break;
      const locationConfig = { apiKey, latlong, radius, units };

      for (const chunk of attractionIdChunks) {
        if (isCancelRequested()) break;
        const data = await tmSearchByAttractionIds(chunk, locationConfig);
        results.push(...parseEvents(data, artistsArr));
        await sleep(180);
      }

      for (const name of unresolvedArtists) {
        if (isCancelRequested()) break;
        const data = await tmSearch(name, locationConfig);
        results.push(...parseEvents(data, artistsArr));
        await sleep(180);
      }
    }

    console.debug("Ticketmaster Search complete - Results:", results);

    await mapWithConcurrency(
      results,
      IMAGE_CHECK_CONCURRENCY,
      async (event) => {
        event.image = await findLargestImage(event.image);
      },
    );

    return results;
  } catch (e) {
    console.error(`searchTMLoop() error - ${e}`);
    return results;
  }
};

// How many events' image checks run at once. Bounds the total number of
// simultaneous outbound HEAD requests (each event has several image
// candidates on top of this) so the production container's DNS resolver
// doesn't get overwhelmed - see the call site for why this exists.
const IMAGE_CHECK_CONCURRENCY = 6;

/**
 * Runs fn over items with at most `limit` calls in flight at once.
 */
async function mapWithConcurrency(items, limit, fn) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

/**
 * Finds the largest image from an array of image objects based on content
 * length. Checks all candidate URLs concurrently (rather than one at a
 * time), with a per-request timeout so one slow/hanging image host can't
 * stall the whole search. Falls back to the metadata-based pick if every
 * HEAD check fails, rather than leaving the event with no image at all.
 * @param {*} imagesObj
 * @returns
 */
async function findLargestImage(imagesObj) {
  if (!imagesObj || imagesObj.length < 1) {
    console.error("findLargestImage() - no images provided");
    return "";
  }

  const sizes = await Promise.all(
    imagesObj.map(async (image) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(image.url, {
          method: "HEAD",
          signal: controller.signal,
        });
        const contentLength = response.headers.get("Content-Length");
        return {
          url: image.url,
          size: contentLength ? parseInt(contentLength, 10) : 0,
        };
      } catch (error) {
        console.error(
          `findLargestImage() Error fetching ${image.url}: ${error}`,
        );
        return { url: image.url, size: 0 };
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  const largest = sizes.reduce((max, curr) =>
    curr.size > max.size ? curr : max,
  );

  return largest.size > 0 ? largest.url : pickCoverImage(imagesObj);
}

/**
 * Pick the best image from an array of Ticketmaster images, based on minimum width and aspect ratio.
 * So far this is still returning low-res images for some events
 * @param {*} imagesArr
 * @returns
 */
function pickCoverImage(imagesArr) {
  if (!imagesArr || imagesArr.length < 1) {
    console.error("pickCoverImage() - no images provided");
    return "";
  }

  const bySize = [...imagesArr].sort((a, b) => (b.width || 0) - (a.width || 0));
  const highRes = bySize.filter((img) => (img.width || 0) >= MIN_IMAGE_WIDTH);
  const pool = highRes.length > 0 ? highRes : bySize;

  let best = null;
  let bestDistance = Infinity;
  for (const img of pool) {
    if (!img.width || !img.height) continue;
    const distance = Math.abs(img.width / img.height - TARGET_RATIO);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = img;
    }
  }

  return (best || pool[0])?.url || "";
}

/**
 * ----------------------------------------------------------------------------------------------------------------
 * parseEvents
 * Parses raw Ticketmaster event objects (from tmSearch/tmSearchByAttractionIds)
 * into the shape lib/eventsStore.js expects, keeping only events that
 * actually list one of our artists as an attraction (a batched
 * attractionId query can return an event whose *other* embedded attractions
 * aren't in artistsArr - e.g. a festival lineup - so this still filters).
 * @param {array} data raw Ticketmaster event objects
 * @param {array} artistsArr
 * @returns {array} eventsArr
 */
function parseEvents(data, artistsArr) {
  const eventsArr = [];
  if (!data || data.length === 0) return eventsArr;

  data.forEach((item) => {
    const url = item.url;
    const image = item.images;
    const attractions = item?._embedded?.attractions || [];
    const isNameInList = attractions.some((attraction) =>
      artistsArr.includes(attraction.name),
    );
    if (!isNameInList) return;

    const acts = attractions.map((act) => act.name);
    let venueName, venueAddress, venueCity, venueState;
    item?._embedded?.venues?.forEach((venue) => {
      venueName = venue.name;
      venueAddress = venue.address?.line1;
      venueCity = venue.city?.name;
      venueState = venue.state?.name;
    });

    let date;
    const start = item.dates.start;
    if (start.localTime)
      date = new Date(`${start.localDate} ${start.localTime}`);
    else if (start.dateTime) date = new Date(start.dateTime);
    else if (start.timeTBA || start.noSpecificTime)
      date = new Date(start.localDate);

    eventsArr.push({
      eName: item.name,
      acts,
      venue: venueName,
      city: venueCity,
      date,
      urls: [{ name: "Ticketmaster", url }],
      image,
      address: `${venueAddress}, ${venueCity}, ${venueState}`,
    });
  });
  return eventsArr;
}

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Resolves an artist name to a Ticketmaster attraction ID via the Attraction
 * Search endpoint, so events can later be fetched by ID instead of keyword.
 * Like the event keyword search, this is a fuzzy text match - prefer an
 * exact (case-insensitive) name match, and otherwise require a high
 * stringSimilarity score before accepting a result, to avoid batching in the
 * wrong artist's events.
 * @param {string} artistName
 * @param {string} apiKey
 * @returns {Promise<string|null>} the attraction ID, or null if no confident match was found
 */
async function resolveAttractionId(artistName, apiKey) {
  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      keyword: artistName,
      size: "20",
    });
    const response = await fetch(`${ATTRACTIONS_URL}?${params.toString()}`);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.errors?.[0]?.detail || "Ticketmaster attraction search failed",
      );
    }

    const attractions = body?._embedded?.attractions || [];
    if (attractions.length === 0) return null;

    const exact = attractions.find(
      (a) => (a.name || "").toLowerCase() === artistName.toLowerCase(),
    );
    if (exact) return exact.id;

    let best = null;
    let bestScore = 0;
    for (const a of attractions) {
      const score = stringSimilarity(a.name || "", artistName);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return bestScore >= ATTRACTION_MATCH_THRESHOLD ? best.id : null;
  } catch (err) {
    console.error(`resolveAttractionId('${artistName}') error: ${err}`);
    return null;
  }
}

/**
 * ----------------------------------------------------------------------------------------------------------------
 * tmSearch
 * Fetch every page of events matching a single artist's keyword. Used as a
 * fallback for artists that couldn't be resolved to an attraction ID.
 * @param {string} keyword
 * @returns {array} results
 */
const tmSearch = (keyword, config) =>
  tmSearchPaged({ keyword, config, pageSize: 20 });

/**
 * ----------------------------------------------------------------------------------------------------------------
 * tmSearchByAttractionIds
 * Fetch every page of events matching any of a batch of attraction IDs -
 * i.e. many artists' events in a single request (Ticketmaster ORs the
 * comma-separated list), instead of one request per artist.
 * @param {string[]} attractionIds
 * @returns {array} results
 */
const tmSearchByAttractionIds = (attractionIds, config) =>
  tmSearchPaged({ attractionIds, config, pageSize: EVENT_PAGE_SIZE });

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Shared pagination loop for both search styles above.
 * @returns {array} results
 */
const tmSearchPaged = async ({ keyword, attractionIds, config, pageSize }) => {
  let page = 0;
  const results = [];

  try {
    let body = await fetchTMEvents({
      ...config,
      page,
      size: pageSize,
      keyword,
      attractionIds,
    });
    const totalPages = body?.page?.totalPages || 0;
    if (body?._embedded) results.push(...body._embedded.events);

    page++;
    while (page < totalPages) {
      if (isCancelRequested()) break;
      await sleep(180);
      body = await fetchTMEvents({
        ...config,
        page,
        size: pageSize,
        keyword,
        attractionIds,
      });
      if (body?._embedded) results.push(...body._embedded.events);
      page++;
    }
  } catch (err) {
    console.error(`tmSearchPaged() error: ${err}`);
    return results;
  }
  return results;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Fetches a single page of the Ticketmaster event search.
 * @returns {object} parsed response body
 */
const fetchTMEvents = async ({
  apiKey,
  latlong,
  radius,
  units,
  page,
  size,
  keyword,
  attractionIds,
}) => {
  const params = new URLSearchParams({
    apikey: apiKey,
    page: String(page),
    size: String(size),
  });
  if (latlong) params.set("latlong", latlong);
  if (radius) params.set("radius", radius);
  if (units) params.set("unit", units);
  if (keyword) params.set("keyword", keyword);
  if (attractionIds?.length)
    params.set("attractionId", attractionIds.join(","));

  const response = await fetch(`${TICKETMASTER_URL}?${params.toString()}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.errors?.[0]?.detail || "Ticketmaster request failed");
  }
  return body;
};
