import { sleep, chunkArray, formatLogDate } from './common.js'
import { getResolvedConfig } from './settings.js'
import { isCancelRequested } from './searchProgress.js'

// JamBase Data Events API (v3, Bearer-token auth - the older v1 /jb-api
// `apikey=` endpoint doesn't accept the Data platform's keys).
// Docs: https://data.jambase.com/api/reference
// Free "Developer" plan: 1,000 calls/month, non-commercial, attribution
// required. Every call counts, so everything here is built around spending
// as few as possible.
const JAMBASE_URL = 'https://api.data.jambase.com/v3/events'
const USER_AGENT = 'music-spider-service'

// `artistName` takes a pipe-delimited list and ORs it, so many artists go in
// one request. 100 is the API's max page size. Names are capped per request
// to keep the URL comfortably short and the number of result pages bounded.
const ARTISTS_PER_REQUEST = 25
const PAGE_SIZE = 100
// Hard stop on pages per batch, so one runaway query can't burn the budget.
const MAX_PAGES_PER_BATCH = 5
const REQUEST_DELAY_MS = 300

/**
 * Whether a name is safe to put in a pipe-delimited list.
 */
const cleanName = name =>
  String(name || '')
    .replace(/\|/g, ' ')
    .trim()

/**
 * Lowercase, accent-stripped, punctuation-free form, for comparing a
 * performer name against our artist list.
 */
const normalizeName = name =>
  String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Normalizes the multi-line latLong setting into [{lat, long}] pairs - same
 * input format the Ticketmaster search accepts (one location per line, any
 * separator within a pair).
 * @param {string} raw
 * @returns {{lat: string, long: string}[]}
 */
export function parseJamBaseLocations(raw) {
  if (!raw) return []
  return raw
    .split('\n')
    .map(line => line.match(/-?\d+(?:\.\d+)?/g))
    .filter(nums => nums && nums.length >= 2)
    .map(nums => ({ lat: nums[0], long: nums[1] }))
}

/**
 * Tracks the API budget across a run, from the response headers JamBase
 * sends back.
 */
export const jambaseUsage = {
  callsThisRun: 0,
  remaining: null,
  keyExpiresOn: null
}

/**
 * Fetches one page of /events. Throws on HTTP errors; 429/403 messages say
 * what went wrong so they show up usefully in logs.
 * @param {object} p
 * @returns {Promise<object>} parsed body
 */
async function fetchJamBaseEvents({ apiKey, params }) {
  const query = new URLSearchParams(params)
  const response = await fetch(`${JAMBASE_URL}?${query.toString()}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  })
  jambaseUsage.callsThisRun++
  const remaining = response.headers.get('x-jb-api-requests-remaining')
  if (remaining !== null) jambaseUsage.remaining = Number(remaining)
  jambaseUsage.keyExpiresOn =
    response.headers.get('x-jb-api-key-expires-on') || jambaseUsage.keyExpiresOn

  if (response.status === 429) throw new Error('JamBase rate limit exceeded')
  if (response.status === 401 || response.status === 403) {
    throw new Error('JamBase API key rejected/expired')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success === false) {
    throw new Error(
      body?.message || `JamBase request failed (${response.status})`
    )
  }
  return body
}

/**
 * Pages through /events for one set of query params, up to maxPages.
 * @returns {Promise<object[]>} raw JamBase event objects
 */
async function fetchAllPages({
  apiKey,
  params,
  maxPages = MAX_PAGES_PER_BATCH
}) {
  const events = []
  for (let page = 1; page <= maxPages; page++) {
    if (isCancelRequested()) break
    const body = await fetchJamBaseEvents({
      apiKey,
      params: { ...params, page: String(page), perPage: String(PAGE_SIZE) }
    })
    events.push(...(body.events || []))
    const totalPages = body.pagination?.totalPages || 1
    if (page >= totalPages) break
    await sleep(REQUEST_DELAY_MS)
  }
  return events
}

/**
 * Converts a JamBase Concert/Festival into the shape lib/eventsStore.js
 * expects (same as the Ticketmaster/RA parsers). Returns null if no
 * performer matches our artist list - `artistName` is a keyword match, so a
 * batch can return near-misses ("Phish" also matching "Phish Food").
 * @param {object} item raw JamBase event
 * @param {Set<string>} artistKeys normalized artist names
 * @param {object} [opts]
 * @param {boolean} [opts.skipTicketmasterOffers] drop Ticketmaster offers (already covered by the Ticketmaster search)
 */
export function parseJamBaseEvent(item, artistKeys, opts = {}) {
  const performers = Array.isArray(item.performer) ? item.performer : []
  if (!performers.some(p => artistKeys.has(normalizeName(p.name)))) return null

  const venue = item.location || {}
  const address = venue.address || {}
  const city = address.addressLocality?.name || address.addressLocality
  const state =
    address.addressRegion?.name || address.addressRegion?.alternateName || ''

  // JamBase tags each offer `ticketingLinkPrimary` (the original seller:
  // Ticketmaster, AXS, DICE, ...) or `ticketingLinkSecondary` (resale:
  // SeatGeek, StubHub, Viagogo, Vivid Seats, ...). The JamBase event page
  // already lists every resale option, so keep only the primary sellers plus
  // that one JamBase link, rather than a link per resale site.
  const offers = (item.offers || []).filter(
    o =>
      o.url &&
      o.category !== 'ticketingLinkSecondary' &&
      !(opts.skipTicketmasterOffers && isTicketmasterSeller(o))
  )
  const urls = offers.map(o => ({
    name: o.seller?.name || 'Tickets',
    url: o.url,
    // Same status codes the Ticketmaster parser reports (onsale | cancelled |
    // postponed | rescheduled), so the Events tab badges work for both.
    status: item.eventStatus === 'scheduled' ? 'onsale' : item.eventStatus
  }))
  // Always keep the JamBase page itself as a link of last resort.
  if (item.url) urls.push({ name: 'JamBase', url: item.url, status: undefined })
  if (urls.length === 0) return null

  return {
    eName: item['x-customTitle'] || item.name,
    acts: performers.map(p => p.name).filter(Boolean),
    venue: venue.name,
    city,
    date: new Date(item.startDate),
    urls,
    image: item.image || '',
    address: [address.streetAddress, city, state].filter(Boolean).join(', '),
    isPackage: false
  }
}

const isTicketmasterSeller = offer =>
  /ticketmaster|live nation/i.test(offer.seller?.name || '')

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Search JamBase for every artist in artistsArr, across every configured
 * location, using as few API calls as possible.
 *
 * Batching: `artistName` accepts a pipe-delimited list, so 25 artists go in
 * one request, and each request is also geo-filtered, so a 300-artist list
 * costs ~12 calls per location (plus extra pages only if a batch has more
 * than 100 matching events) instead of 300. Geo-filtering server-side also
 * means the response contains only nearby shows.
 *
 * Call count ~= ceil(artists / 25) * locations * pages-per-batch.
 *
 * @param {string[]} artistsArr
 * @param {object} [opts]
 * @param {(completed: number, total: number) => void} [opts.onProgress] called per finished batch request group
 * @param {boolean} [opts.skipTicketmasterOffers] drop Ticketmaster ticket links (dedupe with the Ticketmaster search)
 * @param {(err: Error) => void} [opts.onError] called if a request fails (e.g. bad key, rate limit); events found so far are still returned
 * @param {number} [opts.maxCalls] abort once this many calls were made this run
 * @param {string} [opts.dateTo] YYYY-MM-DD upper bound; defaults to 6 months out (the free plan's window)
 * @returns {Promise<object[]>} matched events, shaped for lib/eventsStore.js
 */
export async function searchJamBase(artistsArr, opts = {}) {
  const resolved = await getResolvedConfig()
  const apiKey = resolved.jambaseApiKey
  if (!apiKey) {
    console.error('searchJamBase() - no JamBase API key configured')
    return []
  }

  const locations = parseJamBaseLocations(resolved.latLong)
  const geoList = locations.length > 0 ? locations : [null]
  const units = /^k/i.test(resolved.units || '') ? 'km' : 'mi'
  const radius = resolved.radius || '30'
  const dateTo = opts.dateTo || defaultDateTo()
  const maxCalls = opts.maxCalls ?? Infinity

  const names = [...new Set(artistsArr.map(cleanName).filter(Boolean))]
  const artistKeys = new Set(names.map(normalizeName))
  const batches = chunkArray(names, ARTISTS_PER_REQUEST)
  const totalSteps = batches.length * geoList.length

  jambaseUsage.callsThisRun = 0
  const results = []
  let step = 0
  try {
    for (const geo of geoList) {
      for (const batch of batches) {
        if (isCancelRequested()) break
        if (jambaseUsage.callsThisRun >= maxCalls) {
          console.warn(`searchJamBase() hit maxCalls (${maxCalls}), stopping`)
          return finish(results)
        }
        const params = {
          artistName: batch.join('|'),
          eventDateTo: dateTo,
          // Each call is bounded in size; ordering by date isn't offered, so
          // the page cap above is the guard against runaway results.
          geoRadiusAmount: String(radius),
          geoRadiusUnits: units
        }
        if (geo) {
          params.geoLatitude = geo.lat
          params.geoLongitude = geo.long
        }
        const raw = await fetchAllPages({ apiKey, params })
        for (const item of raw) {
          const parsed = parseJamBaseEvent(item, artistKeys, opts)
          if (parsed) results.push(parsed)
        }
        opts.onProgress?.(++step, totalSteps)
        await sleep(REQUEST_DELAY_MS)
      }
    }
    return finish(results)
  } catch (err) {
    console.error(`searchJamBase() error - ${err}`)
    opts.onError?.(err)
    return finish(results)
  }
}

/**
 * Upcoming events on the free plan only extend ~6 months, so default the
 * range to that rather than fetching nothing useful.
 */
function defaultDateTo() {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d.toISOString().slice(0, 10)
}

/**
 * De-dupes the same show returned by overlapping location searches, logs one
 * line per event, and logs how much of the monthly budget the run used.
 */
function finish(results) {
  const seen = new Set()
  const unique = results.filter(e => {
    const key = `${normalizeName(e.venue)}|${e.date.toDateString()}|${normalizeName(e.acts[0])}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.info(
    `JamBase search complete: ${unique.length} events, ${jambaseUsage.callsThisRun} API calls` +
      (jambaseUsage.remaining !== null
        ? ` (${jambaseUsage.remaining} remaining this period)`
        : '')
  )
  return unique
}

/**
 * Searches a single artist - for lookups outside the batch run. Costs one
 * call (plus pages).
 * @param {string} artistName
 * @param {object} [opts] same as searchJamBase
 */
export const searchJamBaseArtist = (artistName, opts) =>
  searchJamBase([artistName], opts)
