import { sleep } from "@/lib/common.js";
import { getResolvedConfig } from "@/lib/settings.js";

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
 * @returns {array} matched events, shaped for lib/eventsStore.js
 */
export const searchTMLoop = async (artistsArr) => {
  const resolved = await getResolvedConfig();
  const config = {
    apiKey: resolved.ticketmasterApiKey,
    latlong: resolved.latLong,
    radius: resolved.radius,
    units: resolved.units,
  };

  let results = [];
  try {
    for (const artist of artistsArr) {
      const data = await ticketSearch(artist, artistsArr, config);
      if (data) results.push(...data);
      await sleep(180);
    }

    console.debug("searchTMLoop() - New Events", results);

    // Ticketmaster provides a bunch of different images of different sizes.
    // This picks the highest-resolution one for each event.
    for (const event of results) {
      event.image = await findLargestImage(event.image);
    }

    return results;
  } catch (e) {
    console.error(`searchTMLoop() error - ${e}`);
    return [];
  }
};

async function findLargestImage(imagesObj) {
  if (!imagesObj || imagesObj.length < 1) {
    console.error("findLargestImage() - no images provided");
    return "";
  }
  let largestSize = 0;
  let largestImageUrl = null;

  for (const image of imagesObj) {
    const url = image.url;
    try {
      const response = await fetch(url, { method: "HEAD" });
      const contentLength = response.headers.get("Content-Length");

      if (contentLength && parseInt(contentLength, 10) > largestSize) {
        largestSize = parseInt(contentLength, 10);
        largestImageUrl = url;
      }
    } catch (error) {
      console.error(`findLargestImage() Error fetching ${url}: ${error}`);
    }
  }

  return largestImageUrl;
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
      console.debug(`ticketSearch('${keyword}') - No results`);
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
      if (start.localTime) date = new Date(`${start.localDate} ${start.localTime}`);
      else if (start.dateTime) date = new Date(start.dateTime);
      else if (start.timeTBA || start.noSpecificTime) date = new Date(start.localDate);

      console.debug(`ticketSearch('${keyword}') - Found event: ${item.name}`);
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
    console.debug(`ticketSearch() - ${eventsArr.length} events found`);
    return eventsArr;
  } catch (err) {
    console.error(`ticketSearch failed - ${err}`);
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
      throw new Error(body?.errors?.[0]?.detail || "Ticketmaster request failed");
    }

    const totalResults = body?.page?.totalElements;
    const totalPages = body?.page?.totalPages;
    if (totalResults === 0) {
      console.debug(`tmSearch('${keyword}') - No Ticketmaster Results`);
      return [];
    }
    if (body?._embedded) results.push(...body._embedded.events);

    page++;
    while (page < totalPages) {
      await sleep(180);
      console.debug("getting page " + page);

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
      if (nextPageParsed._embedded) results.push(...nextPageParsed._embedded.events);
      page++;
    }
  } catch (err) {
    console.error(`tmSearch() error: ${err}`);
    return [];
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
const returnTMParams = (keyword, page, pageSize, latlong, radius, units, apiKey) => {
  let params = `?apikey=${apiKey}`;
  params += `&latlong=${latlong}`;
  params += `&radius=${radius}`;
  params += `&unit=${units}`;
  params += `&page=${page}`;
  params += `&size=${pageSize}`;
  params += `&keyword=${encodeURIComponent(keyword)}`;
  return params;
};
