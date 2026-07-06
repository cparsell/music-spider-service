import { Config as Configuration } from "../store/configStore.js";
import {
  queryRAEventListings,
  raGql,
  getFieldsQuery,
  testQuery,
  gqlSearchQuery,
  searchAreas,
  getAreas,
} from "./resAdvisorEnums.js";
import { formatDateDashes, formatDateTimeB, sleep } from "../lib/common.js";
import { artistsList } from "../store/artistsListStore.js";
// import { all } from "axios";

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Send fetch requests to Resident Advisor - multiple if getting all pages
 * Returns each event combined in one array
 * @param {string} area which page of results to fetch
 * @param {boolean} getAllPages if false will only return 1 page (18 results max)
 * @returns {array} results [{event}, {event}...]
 */
const fetchEventsForArea = (options, page = 1) => {
  const url = `https://ra.co/graphql`;
  // console.debug(`Searching area: ${area}, page: ${page}`)

  // Fetch from the API
  return fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      const totalResults = data?.data?.eventListings?.totalResults;
      const totalPages = Math.ceil(totalResults / 18);
      return {
        events: data.data.eventListings.data,
        totalPages: totalPages,
      };
    })
    .catch((error) => console.error("fetchEventsForArea() Error:", error));
};

const fetchAllPagesForArea = async (areaId) => {
  let allEvents = new Array();
  console.debug(`Searching RA for events in Area: ${areaId}`);
  const fetchPage = async (page) => {
    try {
      // console.debug(`fetching page ${page}`)
      const results = fetchEventsForArea(
        returnRAOptions(page, areaId),
        page,
      ).then(async (result) => {
        // console.debug(`total pages: ${result.totalPages}`)
        allEvents = allEvents.concat(result.events);

        if (page < result.totalPages) {
          return await fetchPage(page + 1); // Fetch the next page recursively
        } else {
          return allEvents; // When all pages are fetched
        }
      });
      return results;
    } catch (err) {
      console.error(`fetchPage() error: ${err}`);
    }
  };
  const res = await fetchPage(1); // Start fetching from page 1
  return res;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Returns the headers and variables formatted for the API fetch request
 * @param {string} page which page of results to fetch
 * @param {string} area which locality to search in (see list in resAdv_enums)
 * @param {string} theQuery optional, defaults to queryRAEventListings if not provided
 * @returns {object} options {filters:{...}, pageSize, page}
 */
const returnRAOptions = (page, area, theQuery = queryRAEventListings) => {
  let today = new Date();
  let todayFormatted = formatDateDashes(today); // today in yyyy-dd-mm
  let addTime = new Date(today.setMonth(today.getMonth() + 8));
  let addTimeFormatted = formatDateDashes(addTime); // 8 mo from now

  // create variables that go into the Query object
  let variables = {
    filters: {
      areas: { eq: Math.floor(area) },
      listingDate: { gte: todayFormatted, lte: addTimeFormatted },
      listingPosition: { eq: 1 },
    },
    pageSize: 18,
    page: Math.floor(page),
  };

  // Form the query object
  let query = {
    query: theQuery,
    variables: variables,
  };
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    Referer: `https://ra.co/events`,
  };
  let options = {
    headers: headers,
    body: JSON.stringify(query),
    method: "POST",
  };
  return options;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Searches the results to return only events that match artists in your list
 * @param {array} artistList
 */
export const searchRA = async (artistList) => {
  let eventMatches = new Array();
  // Fetch all Resident Advisor events in the next 8 months in your region
  const Config = Configuration.config;

  const areaIds = Config.raRegions
    .filter((region) => region.enabled) // First, filter out only enabled regions
    .map((region) => region.id); // Then, extract only their IDs

  return Promise.all(areaIds.map(fetchAllPagesForArea))
    .then((results) => {
      const combinedEvents = results.flat(); // Combine events from all areas
      // console.debug(`combined events: ${combinedEvents.length}`)
      for (let i = 0; i < combinedEvents.length; i++) {
        let listing = combinedEvents[i]?.event;
        if (listing) {
          let acts = [];
          let artists = listing?.artists;
          if (artists.length > 0) {
            for (let index = 0; index < artists.length; index++) {
              let artist = artists[index].name.toString();
              acts.push(artist);
              // console.debug(artist)
            }
          }
          const shouldAddEvent = acts.some((act) => artistList.includes(act));
          // If the condition is true, add the newEvent to the events array
          if (shouldAddEvent) {
            let title = listing?.title;
            let venue = listing?.venue?.name;
            let imageUrl = listing?.images[0]?.filename;
            eventMatches.push({
              date: formatDateTimeB(new Date(listing.startTime)),
              eName: title,
              city: "",
              venue: venue,
              urls: [
                {
                  name: "Resident Advisor",
                  url: "https://ra.co" + listing.contentUrl,
                },
              ],
              image: imageUrl,
              acts: acts,
              address: listing?.venue?.address,
            });
          }
        }
      }
      return eventMatches;
    })
    .catch((error) => {
      console.error(
        "Error fetching events for multiple areas across all pages:",
        error,
      );
    });
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * DEPRECATED - Main handler function for Resident Advisor API
 * Reaches out to RA API to get results,
 * @param {array} artistsArr the array of artists in the Artists List sheet
 *  @returns {array} [{}]
 */
export const searchRAMain = (artistsArr) => {
  if (Config.searchRA) {
    try {
      // returns events that match your artists
      let results = searchRA(artistsArr);
      // console.info('New RA Events', results)
      return results;
    } catch (err) {
      console.error(`searchRAMain () error - ${err}`);
      return [];
    }
  } else
    console.info(
      "searchRAMain() started but Music Spider is not configured to search Resident Advisor. Skipping.",
    );
};

const testAreaID = async (region) => {
  try {
    // Fetch all Resident Advisor events in the next 8 months in your region
    let listings = await fetchRAEventsForArea(Math.floor(region));
    console.debug("searchRA() - TOTAL events parsed: " + listings.length);
    // console.debug(listing)
    let len = listings.length > 4 ? 4 : listings.length;
    let addressArray = new Array();

    for (let i = 0; i < len; i++) {
      let listing = listings[i]?.event;
      if (listing) {
        // console.debug(listing)
        // let title = listing?.title
        // let acts = []
        // let venue = listing?.venue?.name
        let address = listing?.venue?.address;
        // let eventDate = new Date(listing?.startTime)
        addressArray.push(address);
        // if there are artists listed, create an array with their names
        // (most of RA events don't seem to have artists listed here though)
      }
    }
    return addressArray;
  } catch (err) {
    console.error(`testRA() error: ${err}`);
  }
};

export const iterateAreaIDs = async () => {
  for (let i = 0; i < 400; i++) {
    console.debug(`area: ${i}}`);
    const resp = await testAreaID(i);
    console.debug(resp);
    sleep(200);
  }
};

export const raGetFields = async () => {
  const pageSize = 18; // 18 is the max number of results RA will send in one page
  let page = 1;
  let running = 0;
  const url = `https://ra.co/graphql`;

  let results = new Array();
  try {
    // build the headers for the fetch request
    let query = {
      query: getFieldsQuery,
      // variables: variables,
    };
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      // "referer": "https://ra.co/events/us/bayarea",
      Referer: `https://ra.co/events`,
    };
    let options = {
      // muteHttpExceptions: true,
      headers: headers,
      body: JSON.stringify(query),
      method: "POST",
    };
    // Fetch from the API
    let response = await fetch(url, options);
    let introspectionData = await response.json();

    if (!response.ok) {
      throw new Error(response, body);
    }

    // const data = introspectionData.data.__schema
    // console.debug(introspectionData)

    // console.debug('queryType', data.queryType)
    // console.debug('types', data.types)

    // const queryFields = data.types.filter((type) => type.name == 'Query')[0]
    // console.debug(queryFields)
    const {
      data: {
        __schema: { types },
      },
    } = introspectionData;

    // Find types related to 'Area' or geographic data
    const areaTypes = types.filter(
      (type) =>
        type.name.toLowerCase().includes("area") ||
        type.fields?.some((field) =>
          field.name.toLowerCase().includes("location"),
        ),
    );

    // console.debug(areaTypes)
    for (let i = 0; i < areaTypes.length; i++) {
      const type = areaTypes[i];
      console.debug(`Name: ${type.name}`);
      if (type.inputFields) {
        for (let j = 0; j < type.inputFields.length; j++) {
          console.debug("inputField name: ", field.inputFields[j].name);
        }
      }
      if (type.fields) {
        for (let j = 0; j < type.fields.length; j++) {
          // console.debug('fields: ', field.fields[j])
          console.debug(`field name: ${type.fields[j].name}`);
          if (type.fields[j].args) {
            for (let k = 0; k < type.fields[j].args.length; k++) {
              // console.debug(`field.arg: ${type.fields[j].args[k]}`)
            }
          }
        }
      }
    }
    // for (let i = 0; i < data.types.length; i++) {
    //   let field = data.types[i]
    //   console.debug(`field: ${field.name}`)
    //   if (field.inputFields) {
    //     for (let j = 0; j < field.inputFields.length; j++) {
    //       console.debug('inputField name: ', field.inputFields[j].name)
    //     }
    //   }
    //   if (field.fields) {
    //     for (let j = 0; j < field.fields.length; j++) {
    //       // console.debug('fields: ', field.fields[j])
    //       console.debug(`field name: ${field.fields[j].name}`)
    //       if (field.fields[j].args) {
    //         for (let k = 0; k < field.fields[j].args.length; k++) {
    //           console.debug(`field.arg: ${field.fields[j].args[k]}`)
    //         }
    //       }
    //     }
    //   }
    // }

    // Iterate data.types { name: 'Query'}.fields
    // for (let i = 0; i < queryFields.fields.length; i++) {
    //   let field = queryFields.fields[i]
    //   console
    //   console.debug(`Field: ${field.name}`)
    //   console.debug('Args:')
    //   for (let j = 0; j < field.args.length; j++) {
    //     console.debug(field.args[j])
    //   }
    // }

    // console.debug('mutationType', data.mutationType)
    // console.debug('directives', data.directives)
    return 0;
  } catch (err) {
    console.error(`raGetFields() error: ${err}`);
  }
};

export const raTestQuery = async () => {
  const pageSize = 18; // 18 is the max number of results RA will send in one page
  let page = 1;
  let running = 0;
  const url = `https://ra.co/graphql`;

  let results = new Array();
  const today = new Date();
  const todayFormatted = formatDateDashes(new Date()); // today in yyyy-dd-mm
  const addTime = new Date(today.setMonth(today.getMonth() + 8));
  const addTimeFormatted = formatDateDashes(addTime); // 8 mo from now
  const latlong = Config.latlong.split(",");
  console.debug(`lat: ${latlong[0]}, long: ${latlong[1]}`);
  try {
    // build the headers for the fetch request
    let query = {
      query: queryRAEventListings,
      variables: {
        filters: {
          // areas: { eq: 218 },
          // areas: { in: [218, 552, 310] },
          areas: { in: [218, 552] },
          listingDate: { gte: todayFormatted, lte: addTimeFormatted },
          listingPosition: { eq: 1 },
        },
        pageSize: 18, //max the API will allow seems to be 18
        page: 1,
      },
    };
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      // "referer": "https://ra.co/events/us/bayarea",
      Referer: `https://ra.co/events`,
    };
    let options = {
      // muteHttpExceptions: true,
      headers: headers,
      body: JSON.stringify(query),
      method: "POST",
    };
    // Fetch from the API
    let response = await fetch(url, options);
    let firstPage = await response.json();

    if (!response.ok) {
      throw new Error(response, body);
    }
    console.debug(firstPage);
    let listings = firstPage.data.eventListings.data;
    for (let i = 0; i < 16; i++) {
      console.debug("Listing:");
      // console.debug(listings[i])
      console.debug(listings[i].event.title);
      console.debug(listings[i].event.venue.address);
    }

    return firstPage;
  } catch (err) {
    console.error(`raGetFields() error: ${err}`);
  }
};

export const raGetAreas = () => {
  const url = `https://ra.co/graphql`;
  const query = {
    query: getAreas,
    variables: {
      pageSize: 18, //max the API will allow seems to be 18
      page: 1,
    },
  };
  // try {

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    // "referer": "https://ra.co/events/us/bayarea",
    Referer: `https://ra.co/events`,
  };
  let options = {
    headers: headers,
    body: JSON.stringify(query),
    method: "POST",
  };
  // Fetch from the API
  return fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(response, body);
      }
      return response.json();
    })
    .then((data) => {
      // console.debug(data)
      let locations = [];
      let {
        data: { areas },
      } = data;
      areas.map((location) => {
        locations.push({
          id: location.id,
          name: location.name,
        });
      });

      return locations;
    });
};
