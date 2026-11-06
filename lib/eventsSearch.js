import { getCombinedArtistList } from '@/lib/combinedArtistList.js'
import { searchRA } from '@/app/api/events/resadvisor/route.js'
import { searchTMLoop } from '@/app/api/events/ticketmaster/route.js'
import { searchJamBase } from '@/lib/jambase.js'
import {
  upsertEvent,
  getEvents,
  setDateCalendarEventId,
  setDateCalDavEventId,
  attachIsNew
} from '@/lib/eventsStore.js'
import { ignoredEvents, eventIgnoreKey } from '@/lib/ignoredEvents.js'
import { setProgress, isCancelRequested } from '@/lib/searchProgress.js'
import { attachActsDisplay } from '@/lib/formatActs.js'
import { getResolvedConfig } from '@/lib/settings.js'
import { hasCalendarScope, getStoredTokens } from '@/lib/googleTokens.js'
import { createCalendarEvent } from '@/lib/googleCalendar.js'
import { isServiceAccountEnabled } from '@/lib/googleServiceAccount.js'
import { isCalDavConfigured, createCalDavEvent } from '@/lib/caldav.js'
import {
  buildEventsEmailSubject,
  buildEventsEmailHtml
} from './emailTemplate.js'
import { sendSmtpEmail } from './smtpNotifier.js'
import { sendGmailMessage } from './gmail.js'

/**
 * Compact local date/time for the event-search log lines, e.g. "2027-01-02 20:00".
 * @param {Date|string} date
 * @returns {string}
 */
function formatLogDate(date) {
  const d = new Date(date)
  if (isNaN(d)) return String(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STAGE_WEIGHTS = {
  searching: 0.7,
  saving: 0.15,
  calendar: 0.1,
  caldav: 0.05
}
const PROGRESS_SCALE = 1000

/**
 * Tracks overall progress across the stages of one runEventSearch() call,
 * translating "N/total done within stage X" into a single completed/total
 * pair on the shared searchProgress state, so the reported percentage keeps
 * climbing across the whole operation instead of freezing once the first
 * stage (searching) hits its own 100%.
 * @param {string[]} enabledStages which of STAGE_WEIGHTS' keys apply this run
 */
function makeStageReporter(enabledStages) {
  const totalWeight = enabledStages.reduce(
    (sum, s) => sum + STAGE_WEIGHTS[s],
    0
  )
  let doneWeight = 0
  return {
    report(stage, stageCompleted, stageTotal, phase) {
      const stageWeight = STAGE_WEIGHTS[stage] / totalWeight
      const stageFrac = stageTotal > 0 ? stageCompleted / stageTotal : 0
      setProgress({
        phase,
        completed: Math.round(
          (doneWeight + stageWeight * stageFrac) * PROGRESS_SCALE
        ),
        total: PROGRESS_SCALE
      })
    },
    finishStage(stage) {
      doneWeight += STAGE_WEIGHTS[stage] / totalWeight
    }
  }
}

/**
 * Syncs new event dates to the configured Google Calendar, creating a new
 * calendar event for each date and storing the resulting calendar event ID
 * in the events store.
 * @param {object} newDates { eventId, date, eventSnapshot }[]
 * @param {string} calendarId
 * @param {(processed: number, total: number) => void} [onProgress] called after each date, success or failure
 * @returns {Promise<{synced: number, error: string|null}>}
 */
async function syncNewDatesToCalendar(newDates, calendarId, onProgress) {
  let synced = 0
  let error = null
  let processed = 0
  for (const { eventId, date, eventSnapshot } of newDates) {
    try {
      const dateEntry = eventSnapshot.dates.find(d => d.date === date)
      const created = await createCalendarEvent({
        calendarId,
        summary: eventSnapshot.eName,
        description: (eventSnapshot.acts || []).join(', '),
        location: eventSnapshot.address || eventSnapshot.venue,
        start: date,
        url: dateEntry?.urls?.[0]?.url
      })
      await setDateCalendarEventId(eventId, date, created.id)
      synced++
    } catch (err) {
      console.error('Calendar sync error:', err.message)
      error = err.message
    }
    processed++
    onProgress?.(processed, newDates.length)
  }
  return { synced, error }
}

/**
 * Same as `syncNewDatesToCalendar`, but for a CalDAV calendar - an
 * independent target, so it runs regardless of whether Google Calendar sync
 * is also enabled.
 * @param {object} newDates { eventId, date, eventSnapshot }[]
 * @param {(processed: number, total: number) => void} [onProgress] called after each date, success or failure
 * @returns {Promise<{synced: number, error: string|null}>}
 */
async function syncNewDatesToCalDav(newDates, onProgress) {
  let synced = 0
  let error = null
  let processed = 0
  for (const { eventId, date, eventSnapshot } of newDates) {
    try {
      const dateEntry = eventSnapshot.dates.find(d => d.date === date)
      const created = await createCalDavEvent({
        summary: eventSnapshot.eName,
        description: (eventSnapshot.acts || []).join(', '),
        location: eventSnapshot.address || eventSnapshot.venue,
        start: date,
        url: dateEntry?.urls?.[0]?.url
      })
      await setDateCalDavEventId(eventId, date, created.id)
      synced++
    } catch (err) {
      console.error('CalDAV sync error:', err.message)
      error = err.message
    }
    processed++
    onProgress?.(processed, newDates.length)
  }
  return { synced, error }
}

/**
 * Runs an event search across the configured sources (Ticketmaster/Resident
 * Advisor/JamBase) for the current combined artist list, saves whatever's found, and
 * syncs new dates to Google Calendar and/or a CalDAV calendar if enabled.
 * Shared by the manual "Run Search" button and the scheduled auto-search.
 */
export async function runEventSearch() {
  setProgress({
    running: true,
    phase: 'Building artist list...',
    completed: 0,
    total: 0,
    cancelRequested: false,
    sources: []
  })

  try {
    const config = await getResolvedConfig()
    const enabledStages = [
      'searching',
      'saving',
      config.googleCalendarSyncEnabled && 'calendar',
      config.caldavSyncEnabled && 'caldav'
    ].filter(Boolean)
    const stages = makeStageReporter(enabledStages)
    const sources = config.eventSearchSources?.length
      ? config.eventSearchSources
      : ['ticketmaster', 'resadvisor']
    const searchTicketmaster = sources.includes('ticketmaster')
    const searchResidentAdvisor = sources.includes('resadvisor')
    // Off unless explicitly enabled - the free plan only allows 1,000 calls a
    // month, so it should never run as a side effect of the default sources.
    const searchJamBaseSource =
      !!config.eventSearchSources?.includes('jambase') && !!config.jambaseApiKey

    const artistList = await getCombinedArtistList()

    const sourceLabel = [
      searchTicketmaster && 'Ticketmaster',
      searchResidentAdvisor && 'Resident Advisor',
      searchJamBaseSource && 'JamBase'
    ]
      .filter(Boolean)
      .join(' and ')
    setProgress({
      phase: `Searching ${sourceLabel} (0/${artistList.length} artists)...`,
      completed: 0,
      total: artistList.length
    })

    // RA and Ticketmaster search in parallel. Track each source's
    // own completion separately so the phase text drops a source the moment
    // it actually finishes, instead of continuing to say "Searching
    // Ticketmaster" for however long RA still has left to run.
    // Each source reports its own 0-1 progress and the search stage's bar is
    // their average, so it reaches 100% once every source is done.
    // Ticketmaster has three phases of very different length, weighted here.
    const TM_PHASES = {
      resolve: { weight: 0.2 },
      search: { weight: 0.8 }
    }
    const tmPhaseFraction = { resolve: 0, search: 0 }
    const jbFractionRef = { value: 0 }
    const tmFraction = () =>
      Object.entries(TM_PHASES).reduce(
        (sum, [key, p]) => sum + p.weight * tmPhaseFraction[key],
        0
      )

    // Per-source status shown as chips in the status bar:
    // state is 'running' | 'done' | 'failed'. `fraction` is 0-1 where the
    // source can tell (Ticketmaster, JamBase) and null where it can't (RA).
    const sourceStatus = {}
    if (searchTicketmaster) {
      sourceStatus.ticketmaster = {
        label: 'Ticketmaster',
        state: 'running',
        fraction: 0
      }
    }
    if (searchResidentAdvisor) {
      sourceStatus.resadvisor = {
        label: 'Resident Advisor',
        state: 'running',
        fraction: null
      }
    }
    if (searchJamBaseSource) {
      sourceStatus.jambase = {
        label: 'JamBase',
        state: 'running',
        fraction: 0
      }
    }
    const publishSources = () =>
      setProgress({ sources: Object.values(sourceStatus).map(s => ({ ...s })) })
    // A failed source stays flagged even though its partial results (and the
    // other sources' results) are still saved.
    const markFailed = key => err => {
      sourceStatus[key].state = 'failed'
      sourceStatus[key].error = err?.message || String(err)
      publishSources()
    }
    const markDone = (key, events) => {
      const source = sourceStatus[key]
      if (source.state !== 'failed') source.state = 'done'
      source.fraction = 1
      source.count = events.length
      publishSources()
      reportSearching()
      return events
    }

    function reportSearching() {
      const sources = Object.values(sourceStatus)
      if (sources.length === 0) return
      if (sourceStatus.ticketmaster?.state === 'running') {
        sourceStatus.ticketmaster.fraction = tmFraction()
      }
      if (sourceStatus.jambase?.state === 'running') {
        sourceStatus.jambase.fraction = jbFractionRef.value
      }
      // A source with no fine-grained progress counts as 0 until it's done.
      const average =
        sources.reduce(
          (sum, s) => sum + (s.state !== 'running' ? 1 : (s.fraction ?? 0)),
          0
        ) / sources.length
      const doneCount = sources.filter(s => s.state !== 'running').length
      publishSources()
      stages.report(
        'searching',
        Math.round(average * PROGRESS_SCALE),
        PROGRESS_SCALE,
        `Searching event sources (${doneCount}/${sources.length} done)...`
      )
    }
    publishSources()

    const [raEvents, tmEvents, jbEvents] = await Promise.all([
      (searchResidentAdvisor
        ? searchRA(artistList, markFailed('resadvisor'))
        : Promise.resolve([])
      ).then(events =>
        searchResidentAdvisor ? markDone('resadvisor', events) : events
      ),
      (searchTicketmaster
        ? searchTMLoop(
            artistList,
            (completed, total, phase) => {
              tmPhaseFraction[phase] = total > 0 ? completed / total : 1
              reportSearching()
            },
            markFailed('ticketmaster')
          )
        : Promise.resolve([])
      ).then(events =>
        searchTicketmaster ? markDone('ticketmaster', events) : events
      ),
      (searchJamBaseSource
        ? searchJamBase(artistList, {
            maxCalls: config.jambaseMaxCallsPerSearch || undefined,
            onProgress: (completed, total) => {
              jbFractionRef.value = total > 0 ? completed / total : 1
              reportSearching()
            },
            onError: markFailed('jambase'),
            // Ticketmaster is already searched directly; keep its links out
            // of JamBase's results so shows don't get a duplicate link.
            skipTicketmasterOffers: searchTicketmaster
          })
        : Promise.resolve([])
      ).then(events =>
        searchJamBaseSource ? markDone('jambase', events) : events
      )
    ])
    stages.finishStage('searching')

    // Save whatever was found even if the search was canceled partway
    // through. Track which dates are genuinely new (not just a merged
    // duplicate URL) for calendar sync. Each event gets tagged with the
    // source that returned it, only for the server log below (not stored).
    const taggedEvents = [
      ...raEvents.map(event => ({ event, source: 'Resident Advisor' })),
      ...tmEvents.map(event => ({ event, source: 'Ticketmaster' })),
      ...jbEvents.map(event => ({ event, source: 'JamBase' }))
    ]
    const allReturnedEvents = taggedEvents.map(t => t.event)
    // Switch the status text away from the last "Searching ..." message right
    // away - otherwise it lingers until the first event finishes saving.
    stages.report(
      'saving',
      0,
      allReturnedEvents.length,
      allReturnedEvents.length > 0
        ? `Processing ${allReturnedEvents.length} events found...`
        : 'No events found.'
    )
    const ignoredKeys = new Set(await ignoredEvents.getAll())
    const newDates = []
    // Per-source tallies for the log: found / new / known / ignored.
    const tally = {}
    if (allReturnedEvents.length > 0) {
      console.info(`Event search found ${allReturnedEvents.length} events:`)
      for (let i = 0; i < taggedEvents.length; i++) {
        const { event, source } = taggedEvents[i]
        const counts = (tally[source] ||= {
          found: 0,
          new: 0,
          known: 0,
          ignored: 0
        })
        counts.found++
        let status = 'ignored'
        if (!ignoredKeys.has(eventIgnoreKey(event, event.date))) {
          const result = await upsertEvent(event)
          if (result.isNewDate) {
            newDates.push(result)
            status = 'new'
          } else {
            status = 'known'
          }
        }
        counts[status]++
        console.info(
          `  [${source}] ${status.padEnd(7)} ${formatLogDate(event.date)} | ${event.eName} @ ${event.venue || 'unknown venue'}`
        )
        stages.report(
          'saving',
          i + 1,
          allReturnedEvents.length,
          `Processing events found (${i + 1}/${allReturnedEvents.length})...`
        )
      }
      for (const [source, c] of Object.entries(tally)) {
        console.info(
          `Event search - ${source}: ${c.found} found, ${c.new} new, ${c.known} already known, ${c.ignored} ignored`
        )
      }
    } else {
      console.info('Event search found 0 events')
    }
    stages.finishStage('saving')

    const newEventsForEmail = [
      ...new Map(newDates.map(r => [r.eventId, r.eventSnapshot])).values()
    ]
    const knownArtists = new Set(await getCombinedArtistList())
    if (
      newDates.length > 0 &&
      ((config.smtpNewEventsEnabled && !!config.smtpRecipient) ||
        (config.googleNewEventsEmailEnabled && !!config.googleEmailRecipient))
    ) {
      setProgress({ phase: 'Sending new-event notifications...' })
    }
    if (
      config.smtpNewEventsEnabled &&
      !!config.smtpRecipient &&
      !!config.smtpHost &&
      newDates.length > 0
    ) {
      try {
        await sendSmtpEmail({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          user: config.smtpUser,
          password: config.smtpPassword,
          from: config.smtpFrom,
          to: config.smtpRecipient,
          subject: buildEventsEmailSubject(
            newEventsForEmail,
            knownArtists,
            true
          ),
          html: buildEventsEmailHtml(newEventsForEmail, knownArtists, true)
        })
        console.info(
          `New Events SMTP email sent to ${config.smtpRecipient} (${newEventsForEmail.length} events)`
        )
      } catch (err) {
        console.error(`Error sending SMTP new events message: ${err.message}`)
      }
    }

    if (
      config.googleNewEventsEmailEnabled &&
      !!config.googleEmailRecipient &&
      newDates.length > 0
    ) {
      // Check if Google OAuth is connected here
      // if Google OAuth is connected then send email using Google API
      try {
        const tokens = await getStoredTokens()
        if (!!tokens) {
          await sendGmailMessage({
            to: config.googleEmailRecipient,
            subject: buildEventsEmailSubject(
              newEventsForEmail,
              knownArtists,
              true
            ),
            html: buildEventsEmailHtml(newEventsForEmail, knownArtists, true)
          })
          console.info(
            `New events email sent to ${config.googleEmailRecipient} (${newEventsForEmail.length} events)`
          )
        } else {
          console.info(
            `Google is not connected. Connect using Google OAuth to send email with Google API.`
          )
        }
      } catch (err) {
        console.error(`Error sending Gmail new events message: ${err.message}`)
      }
    }

    let calendarSynced = 0
    let calendarError = null
    if (config.googleCalendarSyncEnabled) {
      if (newDates.length > 0) {
        // hasCalendarScope() checks the OAuth token's granted scope, which
        // has no equivalent in service account mode - there's no user grant
        // to check, so just attempt the sync and let a bad key surface as a
        // calendarError from syncNewDatesToCalendar itself.
        const authorized =
          isServiceAccountEnabled(config) || (await hasCalendarScope())
        if (authorized) {
          ;({ synced: calendarSynced, error: calendarError } =
            await syncNewDatesToCalendar(
              newDates,
              config.calendarId,
              (processed, total) =>
                stages.report(
                  'calendar',
                  processed,
                  total,
                  `Syncing to Google Calendar (${processed}/${total})...`
                )
            ))
        } else {
          calendarError =
            'Google Calendar sync is enabled but not authorized. Reconnect Google in config.'
        }
      }
      stages.finishStage('calendar')
    }

    let caldavSynced = 0
    let caldavError = null
    if (config.caldavSyncEnabled) {
      if (newDates.length > 0) {
        if (isCalDavConfigured(config)) {
          ;({ synced: caldavSynced, error: caldavError } =
            await syncNewDatesToCalDav(newDates, (processed, total) =>
              stages.report(
                'caldav',
                processed,
                total,
                `Syncing to CalDAV (${processed}/${total})...`
              )
            ))
        } else {
          caldavError =
            'CalDAV sync is enabled but not fully configured. Add the URL/username/password in config.'
        }
      }
      stages.finishStage('caldav')
    }

    setProgress({ completed: PROGRESS_SCALE })

    const result = {
      artistsSearched: artistList.length,
      found: raEvents.length + tmEvents.length + jbEvents.length,
      newFound: newDates.length,
      canceled: isCancelRequested(),
      calendarSynced,
      calendarError,
      caldavSynced,
      caldavError
    }
    // Stored on the shared progress state (not just returned here) so a
    // client that reconnects after switching away mid-search - rather than
    // the one that made this request - can still learn how it turned out.
    setProgress({ result })
    return {
      events: attachIsNew(await attachActsDisplay(await getEvents())),
      ...result
    }
  } catch (err) {
    console.error('runEventSearch() error:', err)
    setProgress({ result: { error: err.message } })
    throw err
  } finally {
    setProgress({ running: false })
  }
}
