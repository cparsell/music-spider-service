import { queryRAEventListings } from "@/lib/resAdv.js";
import { formatDateDashes, formatDateTimeB } from "@/lib/common.js";
import { getResolvedConfig } from "@/lib/settings.js";
import { isCancelRequested } from "@/lib/searchProgress.js";

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Send a single page request to Resident Advisor
 * @returns {object} {events, totalPages}
 */
const fetchEventsForArea = (options) => {
  const url = `https://ra.co/graphql`;
  return fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      const totalResults = data?.data?.eventListings?.totalResults || 0;
      return {
        events: data?.data?.eventListings?.data || [],
        totalPages: Math.ceil(totalResults / 18),
      };
    })
    .catch((error) => {
      console.error("fetchEventsForArea() Error:", error);
      return { events: [], totalPages: 0 };
    });
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Fetches every page of results for one RA area, recursively.
 * @param {number} areaId
 * @returns {array} all events found in that area
 */
const fetchAllPagesForArea = async (areaId) => {
  let allEvents = [];
  console.debug(`Searching RA for events in Area: ${areaId}`);
  const fetchPage = async (page) => {
    if (isCancelRequested()) return allEvents;
    const result = await fetchEventsForArea(returnRAOptions(page, areaId));
    allEvents = allEvents.concat(result.events);
    if (page < result.totalPages) {
      return fetchPage(page + 1);
    }
    return allEvents;
  };
  return fetchPage(1);
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Returns the headers and variables formatted for the RA GraphQL fetch request
 * @param {number} page which page of results to fetch
 * @param {number} area which RA area ID to search
 * @returns {object} fetch options
 */
const returnRAOptions = (page, area) => {
  const today = new Date();
  const todayFormatted = formatDateDashes(today);
  const addTime = new Date(new Date().setMonth(today.getMonth() + 8));
  const addTimeFormatted = formatDateDashes(addTime); // 8 mo from now

  const variables = {
    filters: {
      areas: { eq: Math.floor(area) },
      listingDate: { gte: todayFormatted, lte: addTimeFormatted },
      listingPosition: { eq: 1 },
    },
    pageSize: 18,
    page: Math.floor(page),
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    Referer: `https://ra.co/events`,
  };
  return {
    headers,
    body: JSON.stringify({ query: queryRAEventListings, variables }),
    method: "POST",
  };
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Searches Resident Advisor across all configured regions and returns only
 * events whose lineup includes at least one artist from artistList.
 * @param {array} artistList
 * @returns {array} matched events, shaped for lib/eventsStore.js
 */
export const searchRA = async (artistList) => {
  const config = await getResolvedConfig();
  // Comma-separated Resident Advisor area IDs to search, e.g. "518,552"
  const RA_REGIONS = (config.raRegion || "218")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => parseInt(id, 10));

  if (RA_REGIONS.length === 0) {
    console.info("searchRA() - No RA_REGION configured, skipping");
    return [];
  }
  try {
    const results = await Promise.all(RA_REGIONS.map(fetchAllPagesForArea));
    const combinedEvents = results.flat();
    const eventMatches = [];

    for (const combined of combinedEvents) {
      const listing = combined?.event;
      if (!listing) continue;

      const acts = (listing.artists || []).map((a) => a.name.toString());
      const shouldAddEvent = acts.some((act) => artistList.includes(act));
      if (!shouldAddEvent) continue;

      eventMatches.push({
        date: formatDateTimeB(new Date(listing.startTime)),
        eName: listing.title,
        city: "",
        venue: listing.venue?.name,
        urls: [
          {
            name: "Resident Advisor",
            url: "https://ra.co" + listing.contentUrl,
          },
        ],
        image: listing.images?.[0]?.filename,
        acts,
        address: listing.venue?.address,
      });
    }
    console.log("TEST");
    console.log(eventMatches);
    return eventMatches;
  } catch (err) {
    console.error("searchRA() error:", err);
    return [];
  }
};
