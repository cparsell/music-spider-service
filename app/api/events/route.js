import {
  attachIsNew,
  getEvents,
  removeEvent,
  upsertEvent
} from '@/lib/eventsStore.js'
import { ignoredEvents } from '@/lib/ignoredEvents.js'
import { attachActsDisplay } from '@/lib/formatActs.js'

export async function GET() {
  return Response.json({
    events: attachIsNew(await attachActsDisplay(await getEvents()))
  })
}

const str = v => (typeof v === 'string' ? v.trim() : '')

// Manually-entered event. Only name, venue and date are required; everything
// else (address, acts, image, ticket URLs with optional sales/presales) may
// be left out.
export async function POST(req) {
  try {
    const body = await req.json()
    const eName = str(body.eName)
    const venue = str(body.venue)
    if (!eName) throw new Error('Event name is required')
    if (!venue) throw new Error('Venue is required')

    const parsed = new Date(body.date)
    if (!body.date || isNaN(parsed)) throw new Error('A valid date is required')

    const acts = (Array.isArray(body.acts) ? body.acts : [])
      .map(str)
      .filter(Boolean)

    const urls = (Array.isArray(body.urls) ? body.urls : [])
      .map(u => ({
        name: str(u?.name) || 'Manual',
        url: str(u?.url),
        ...(u?.status ? { status: str(u.status) } : {}),
        ...(u?.sales ? { sales: u.sales } : {})
      }))
      .filter(u => /^https?:\/\//i.test(u.url))

    const { events } = await upsertEvent({
      eName,
      venue,
      city: str(body.city),
      address: str(body.address) || undefined,
      image: str(body.image) || undefined,
      date: parsed.toISOString(),
      acts,
      urls,
      source: 'manual'
    })
    return Response.json({
      events: attachIsNew(await attachActsDisplay(events))
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(req) {
  try {
    const { id, ignore } = await req.json()
    if (ignore) {
      const event = (await getEvents()).find(e => e.id === id)
      if (event) {
        await ignoredEvents.addDates(
          event,
          (event.dates || []).map(d => d.date)
        )
      }
    }
    const events = await removeEvent(id)
    return Response.json({
      events: attachIsNew(await attachActsDisplay(events))
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
