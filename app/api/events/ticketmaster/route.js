import { sleep } from "@/lib/common.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { isCancelRequested } from "@/lib/searchProgress.js";

const TICKETMASTER_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Search Ticketmaster for every artist in artistsArr.
 *
 * Ticketmaster API stops you if we try to get too many pages of data (max is... ?)
 * So we can't just get all the events in an area and filter out the artists one likes (less requests)
 * Instead this sends a request for each artist - not very efficient but seems to be
 * the way it has to be done
 * Any events returned that contain the artist's name are added to the results
 * API Docs: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/
 * API Explorer: https://developer.ticketmaster.com/api-explorer/v2/
 * Reference: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#search-events-v2
 * @param {array} artistsArr
 * @param {(completed: number, total: number) => void} [onProgress] called after each artist is searched
 * @returns {array} matched events, shaped for lib/eventsStore.js
 */
export const searchTMLoop = async (artistsArr, onProgress) => {
  const resolved = await getResolvedConfig();
  const config = {
    apiKey: resolved.ticketmasterApiKey,
    latlong: resolved.latLong,
    radius: resolved.radius,
    units: resolved.units,
  };

  let results = [];
  try {
    for (let i = 0; i < artistsArr.length; i++) {
      if (isCancelRequested()) break;
      const data = await ticketSearch(artistsArr[i], artistsArr, config);
      if (data) results.push(...data);
      onProgress?.(i + 1, artistsArr.length);
      await sleep(180);
    }

    console.debug("Ticketmaster Search complete - Results:", results);

    // HEAD-checking every image of every event used to happen one request
    // at a time (event-by-event, image-by-image). These are all independent
    // network calls with no shared rate limit, so fire them all concurrently
    // instead.
    await Promise.all(
      results.map(async (event) => {
        event.image = await findLargestImage(event.image);
      }),
    );

    return results;
  } catch (e) {
    console.error(`searchTMLoop() error - ${e}`);
    return results;
  }
};

/**
 * Finds the largest image from an array of image objects based on content
 * length. Checks all candidate URLs concurrently (rather than one at a
 * time), with a per-request timeout so one slow/hanging image host can't
 * stall the whole search - since this now runs inside a larger
 * `Promise.all` across every event, a single hung request would otherwise
 * hold up everything else too.
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

  return largest.size > 0 ? largest.url : null;
}

// Event cards render at a tall aspect-6/8 with object-cover, so a wide
// landscape source image gets cropped hard on the sides - a squarer source
// loses far less. Ticketmaster tags each image with its pixel dimensions
// (no extra fetch needed, unlike comparing file sizes), so first drop
// anything below a minimum resolution, then prefer whichever remaining
// image's aspect ratio is closest to the card's.
const MIN_IMAGE_WIDTH = 300;
const TARGET_RATIO = 6 / 8;

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
 * ticketSearch
 * Search Ticketmaster. Runs tmSearch function and parses response data.
 * @param {string} keyword
 * @returns {array} eventsArr
 */
const ticketSearch = async (keyword, artistsArr, config) => {
  if (keyword == undefined) {
    console.debug("ticketSearch() - No keyword provided");
    return [];
  }
  const eventsArr = [];
  try {
    const data = await tmSearch(keyword, config);
    if (data.length == 0) {
      console.debug(
        `ticketSearch() Searching Ticketmaster '${keyword}' - No results`,
      );
      return eventsArr;
    }
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

      // console.debug(
      //   `ticketSearch() Searching Ticketmaster '${keyword}' - Found event: ${item.name}`,
      // );
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
    console.debug(
      `ticketSearch() Ticketmaster - ${eventsArr.length} events found`,
    );
    return eventsArr;
  } catch (err) {
    console.error(`ticketSearch() Ticketmaster search failed - ${err}`);
    return eventsArr;
  }
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * tmSearch
 * Fetch data from Ticketmaster API
 * @param {string} keyword
 * @returns {array} results
 */
const tmSearch = async (keyword, config) => {
  let page = 0;
  const pageSize = 20;
  const results = [];

  let params = returnTMParams(
    keyword,
    page,
    pageSize,
    config.latlong,
    config.radius,
    config.units,
    config.apiKey,
  );

  try {
    let response = await fetch(TICKETMASTER_URL + params);
    let body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.errors?.[0]?.detail || "Ticketmaster request failed",
      );
    }

    const totalResults = body?.page?.totalElements;
    const totalPages = body?.page?.totalPages;
    if (totalResults === 0) {
      return [];
    }
    if (body?._embedded) results.push(...body._embedded.events);

    page++;
    while (page < totalPages) {
      await sleep(180);
      // console.debug("getting page " + page);

      params = returnTMParams(
        keyword,
        page,
        pageSize,
        config.latlong,
        config.radius,
        config.units,
        config.apiKey,
      );
      const nextPage = await fetch(TICKETMASTER_URL + params);
      const nextPageParsed = await nextPage.json();
      if (nextPageParsed._embedded)
        results.push(...nextPageParsed._embedded.events);
      page++;
    }
  } catch (err) {
    console.error(`tmSearch() error: ${err}`);
    return results;
  }
  console.debug(`tmSearch('${keyword}') parsed ${results.length} results`);
  return results;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Return parameters for Ticketmaster API fetch URL
 * @param {string} keyword name of artist being searched
 * @param {number} page the page number we want in return - starts with 0
 * @param {number} pageSize number of results returned in each response
 * @returns {string} params encoded parameters for Ticketmaster API query
 */
const returnTMParams = (
  keyword,
  page,
  pageSize,
  latlong,
  radius,
  units,
  apiKey,
) => {
  let params = `?apikey=${apiKey}`;
  params += `&latlong=${latlong}`;
  params += `&radius=${radius}`;
  params += `&unit=${units}`;
  params += `&page=${page}`;
  params += `&size=${pageSize}`;
  params += `&keyword=${encodeURIComponent(keyword)}`;
  return params;
};
