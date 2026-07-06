const TICKETMASTER_URL =
  "https://app.ticketmaster.com/discovery/v2/events.json";

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Search Ticketmaster for every artist in Artists Sheets
 * Main function for Ticketmaster search. Searches Ticketmaster for artists found in Spotify or added manually.
 *
 * Ticketmaster API stops you if we try to get too many pages of data (max is... ?)
 * So we can't just get all the events in an area and filter out the artists one likes (less requests)
 * Instead this sends a request for each artist - not very efficient but seems to be
 * the way it has to be done
 * Any events returned that contain the artist's name are added to the sheet
 * API Docs: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/
 * API Explorer: https://developer.ticketmaster.com/api-explorer/v2/
 * Reference: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#search-events-v2
 */
export const searchTMLoop = async (artistsArr) => {
  //search each artist in TM
  const Config = Configuration.config;

  let results = new Array();
  try {
    for (let i = 0; i < artistsArr.length; i++) {
      await ticketSearch(artistsArr[i], artistsArr, Config).then((data) =>
        data.forEach((event) => results.push(event)),
      );
      await sleep(180);
    }

    console.debug("searchTMLoop() - New Events", results);

    // Ticketmaster provides a bunch of different images of different sizes
    // This function will run through the newfound events and select the highest res image
    // const arrayOfImageURLs = results.map(item => item.image);
    for (let i = 0; i < results.length; i++) {
      const largestImage = await findLargestImage(results[i].image);
      console.debug("searchTMLoops() largestImage:", largestImage);
      results[i].image = largestImage;
    }

    return results;
  } catch (e) {
    console.error(`SearchTMLoop() error - ${e}`);
    return [];
  }
};

async function findLargestImage(imagesObj) {
  if (imagesObj.length < 1) {
    console.error(
      `findLargestImage(imageUrls: ${imageUrls}) - imageUrls is empty`,
    );
    return "";
  }
  let largestSize = 0;
  let largestImageUrl = null;

  for (const image of imagesObj) {
    try {
      const url = image.url;
      const response = await fetch(url, { method: "HEAD" }); // Use HEAD request to get headers only
      const contentLength = response.headers.get("Content-Length");

      if (contentLength && parseInt(contentLength, 10) > largestSize) {
        largestSize = parseInt(contentLength, 10);
        // console.debug(`findLargestImage() found largest url: ${url}`)
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
 * Process Images in Ticketmaster API response
 * Response usually includes multiple images. This function limits it to just the largest one.
 * @param {object} eventsArr [{eName, date, city, venue, url, image, acts}, ...]
 * @returns {object} eventsArr returns the events array with the image limited to the largest one
 */
const filterTMimages = (eventsArr) => {
  if (eventsArr.length == 0) return [];
  // loop through all the new events
  for (let i = 0; i < eventsArr.length; i++) {
    let item = eventsArr[i];
    let image = [[0, 0]];

    // Loop through image URLs in JSON response. Find the one with the largest filesize
    for (let i = 0; i < item.image.length; i++) {
      // let img = new Images();
      let img = fetch(item.image[i].url).getBlob();
      let imgBytes = img.getBytes().length;

      if (imgBytes > image[0][1]) {
        image[0][0] = i;
        image[0][1] = imgBytes;
      }
    }
    const result = item.image[image[0][0]].url;
    console.debug("filterTMimages() - Ticketmaster, Image URL", result);
    // replace array.image with just the largest image
    eventsArr[i].image = result;
  }
  return eventsArr;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * ticketSearch
 * Search Ticketmaster. Runs tmSearch function and parses response data.
 * @param {string} keyword
 * @returns {object} eventsArr
 */
const ticketSearch = async (keyword, artistsArr, Config) => {
  // keyword = "The Books" // for debugging, I uncomment this, specify something that returns a result, and run the function from Apps Script to see the Execution Log
  if (keyword == undefined) {
    console.debug("ticketSearch() - No keyword provided");
    return;
  }
  let eventsArr = new Array();
  try {
    // returns JSON response
    await tmSearch(keyword, Config).then((data) => {
      // console.debug(
      //   `ticketSearch('${keyword}') - ${data.length} results from search`
      // )
      if (data.length == 0) {
        console.debug(`ticketSearch('${keyword}') - No results`);
        return false;
      }
      data.forEach((item) => {
        let url = item.url;
        let image = item.images;
        let attractions = item?._embedded?.attractions;
        let isNameInList = attractions.some((attraction) =>
          artistsArr.includes(attraction.name),
        );
        if (isNameInList) {
          let acts = new Array();
          attractions.forEach((act) => acts.push(act.name));
          let venueName;
          let venueAddress;
          let venueCity;
          let venueState;
          item?._embedded?.venues?.forEach((venue) => {
            // console.debug(`venue`, venue)
            venueName = venue.name;
            venueAddress = venue.address.line1;
            venueCity = venue.city.name;
            venueState = venue.state.name;
          });
          let date;
          let start = item.dates.start;
          // item.dates.start {
          //   localDate: '2024-10-02',
          //   localTime: '20:00:00',
          //   dateTime: '2024-10-03T03:00:00Z',
          // }
          if (start.localTime)
            date = new Date(`${start.localDate} ${start.localTime}`);
          else if (start.dateTime) date = new Date(start.dateTime);
          // some list timeTBA = true, or noSpecificTime = true. if so, use localDate value
          else if (start.timeTBA || start.noSpecificTime)
            date = new Date(start.localDate);
          console.debug(
            `ticketSearch('${keyword}') - Found event: ${item.name}`,
          );
          eventsArr.push({
            eName: item.name,
            acts: acts,
            venue: venueName,
            city: venueCity,
            date: date,
            urls: [{ name: "Ticketmaster", url: url }],
            image: image,
            address: `${venueAddress}, ${venueCity}, ${venueState}`,
          });
        }
      });
      if (eventsArr.length == 0) {
        console.debug(
          `ticketSearch('${keyword}') - No events found in results `,
        );
        return;
      }
      console.debug(`ticketSearch() - eventsArr: ${eventsArr}`);
    });
    console.debug(`ticketSearch() - ${eventsArr.length} events found`);
    return eventsArr;
  } catch (err) {
    console.error(`ticketSearch failed - ${err}`);
  }
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * tmSearch
 * Fetch data from Ticketmaster API
 * @param {object} event {name, date, city, venue, url, image, acts}
 * @returns {object} results
 */
const tmSearch = async (keyword, Config) => {
  let page = 0;
  const pageSize = 20;
  let results = new Array();
  const options = {
    method: "GET",
    async: true,
    contentType: "application/json",
  };
  let params = returnTMParams(
    keyword,
    page,
    pageSize,
    Config.latlong,
    Config.radius,
    Config.units,
  );

  // First page
  try {
    let response = await fetch(TICKETMASTER_URL + params, options);
    const body = await response.json();
    // console.debug(body)
    if (!response.ok) {
      throw new Error(response, body);
    }
    // console.info("tmSearch() - response", data);  // uncomment this to write raw JSON response to 'Logger' sheet

    const totalResults = body?.page?.totalElements;
    const totalPages = body?.page?.totalPages;
    const resultPageSize = body?.page?.size;
    // console.debug(
    //   `tmSearch('${keyword}') - results: ${totalResults}, pages: ${totalPages}, page size: ${resultPageSize}`
    // )
    if (totalResults === 0) {
      console.debug(`tmSearch('${keyword}') - No Ticketmaster Results`);
      return [];
    }
    if (body?._embedded) results.push(...body?._embedded?.events);

    page++;
    // Rest of the pages if there are more
    while (page < totalPages) {
      // for (let pg = 1; pg < totalPages; pg++) {
      sleep(180);
      console.debug("getting page " + page);

      params = returnTMParams(
        keyword,
        page,
        pageSize,
        Config.latlong,
        Config.radius,
        Config.units,
      );
      const nextPage = await fetch(TICKETMASTER_URL + params, options);
      const nextPageParsed = await nextPage.json();
      if (nextPageParsed._embedded)
        results.push(...nextPageParsed._embedded?.events);
      page++;
    }
    // console.info("tmSearch() results", results);
  } catch (err) {
    console.error(`tmSearch() error: ${err}`);
    return {};
  }
  console.debug(`tmSearch('${keyword}') parsed ${results.length} results`);
  return results;
};

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Return parameters for Ticketmaster API fetch URL
 * @param {string} keyword name of artist being searched
 * @page {integer} page the page number we want in return - starts with 0
 * @param {integer} pageSize number of results returned in each response
 * @returns {string} params encoded parameters for Ticketmaster API query
 */
const returnTMParams = (keyword, page, pageSize, latlong, radius, units) => {
  let params = `?apikey=${process.env.TICKETMASTER_API_KEY}`;
  // params += `&postalCode=`;
  // params += `&city=Los+Angeles`;   // seems to negate the radius settings - latlong setting seems to work better
  params += `&latlong=${latlong}`;
  params += `&radius=${radius}`; // radius only seems to work with latlong
  params += `&unit=${units}`;
  params += `&page=${page}`;
  params += `&size=${pageSize}`;
  params += `&keyword=${encodeURIComponent(keyword)}`;
  return params;
};
