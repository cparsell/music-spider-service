/**
 * ----------------------------------------------------------------------------------------------------------------
 * Derives a ticket sale phase from a Ticketmaster event's `sales` block.
 * Ticketmaster's `dates.status.code` of "offsale" is ambiguous - it is used
 * both before sales have started and after they have ended - so the phase is
 * worked out from the timestamps and the status code is only a fallback.
 *
 * @param {object} event
 * @param {string} [event.status] dates.status.code (onsale | offsale | ...)
 * @param {object} [event.sales] Ticketmaster `sales` object:
 *   { public: { startDateTime, endDateTime, startTBD, startTBA },
 *     presales: [{ startDateTime, endDateTime, name, url, ... }] }
 * @param {Date|string|number} [now] injectable for testing
 * @returns {{phase: string, label: string, date: Date|null, presale: object|null}}
 *   phase: onsale | presale | presale-upcoming | upcoming | tba | ended | unknown
 *   date: the next relevant date to show (start or end), if any
 *   presale: the presale entry the phase refers to, if any
 */
export function getSalePhase({ status, sales } = {}, now = new Date()) {
  const t = new Date(now).getTime()
  const parse = v => {
    const d = v ? new Date(v) : null
    return d && !isNaN(d) ? d : null
  }
  const fmt = d =>
    d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const result = (phase, label, date = null, presale = null) => ({
    phase,
    label,
    date,
    presale
  })

  const pub = sales?.public || {}
  const pubStart = parse(pub.startDateTime)
  const pubEnd = parse(pub.endDateTime)

  const presales = (sales?.presales || [])
    .map(p => ({ ...p, _start: parse(p.startDateTime), _end: parse(p.endDateTime) }))
    .filter(p => p._start || p._end)

  // Public sale is open.
  if (pubStart && pubStart.getTime() <= t && (!pubEnd || t < pubEnd.getTime())) {
    // A sold-out or paused event reports offsale despite an open window.
    if (status === 'offsale') return result('ended', 'Off sale')
    return result('onsale', 'On sale', pubEnd)
  }

  // Public sale is over.
  if (pubEnd && pubEnd.getTime() <= t) return result('ended', 'Sales ended', pubEnd)

  // Public sale has not started (or has no date): a live presale wins.
  const live = presales
    .filter(
      p =>
        (!p._start || p._start.getTime() <= t) &&
        (!p._end || t < p._end.getTime())
    )
    .sort((a, b) => (a._end?.getTime() ?? Infinity) - (b._end?.getTime() ?? Infinity))[0]
  if (live) {
    return result(
      'presale',
      live._end ? `Presale until ${fmt(live._end)}` : 'Presale on now',
      live._end,
      live
    )
  }

  const nextPresale = presales
    .filter(p => p._start && p._start.getTime() > t)
    .sort((a, b) => a._start - b._start)[0]
  if (nextPresale && (!pubStart || nextPresale._start < pubStart)) {
    return result(
      'presale-upcoming',
      `Presale starts ${fmt(nextPresale._start)}`,
      nextPresale._start,
      nextPresale
    )
  }

  if (pubStart) return result('upcoming', `On sale ${fmt(pubStart)}`, pubStart)

  if (pub.startTBD || pub.startTBA) return result('tba', 'On-sale date TBA')

  if (status === 'offsale') return result('unknown', 'Not on sale')
  return result('unknown', '')
}
