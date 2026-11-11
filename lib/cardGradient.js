// Gradient fill for event cards that have no image.
//
// Tailwind only generates classes it finds written out *in full* in a source
// file, so `from-${color}-300` would produce nothing. The palette is therefore
// literal class names in these two tables, and an event stores just the keys
// ({ angle, from }) - the angle in degrees and the color name - which are
// looked up here at render time.

const ANGLE_CLASSES = {
  30: 'bg-linear-30',
  45: 'bg-linear-45',
  60: 'bg-linear-60',
  120: 'bg-linear-120',
  135: 'bg-linear-135',
  150: 'bg-linear-150',
  210: 'bg-linear-210',
  225: 'bg-linear-225',
  240: 'bg-linear-240',
  300: 'bg-linear-300',
  315: 'bg-linear-315',
  330: 'bg-linear-330'
}

const FROM_CLASSES = {
  red: 'from-red-300/80',
  orange: 'from-orange-300/80',
  amber: 'from-amber-300/80',
  green: 'from-green-300/80',
  teal: 'from-teal-300/80',
  cyan: 'from-cyan-300/80',
  sky: 'from-sky-300/80',
  indigo: 'from-indigo-300/80',
  violet: 'from-violet-300/80',
  fuchsia: 'from-fuchsia-300/80',
  pink: 'from-pink-300/80',
  rose: 'from-rose-300/80'
}

const ANGLES = Object.keys(ANGLE_CLASSES).map(Number)
const COLORS = Object.keys(FROM_CLASSES)

function pick(list, n) {
  return list[n % list.length]
}

function hash(str) {
  let h = 0
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/**
 * Picks a random angle and start color. Called once when an event without an
 * image is saved, so the card keeps the same gradient on every render.
 * @returns {{angle: number, from: string}}
 */
export function generateCardGradient() {
  return {
    angle: pick(ANGLES, Math.floor(Math.random() * ANGLES.length)),
    from: pick(COLORS, Math.floor(Math.random() * COLORS.length))
  }
}

/**
 * Class string for a stored gradient. Events saved before gradients were
 * stored (or with an unknown key) get one derived from `seed` (the event id),
 * so they are still stable between renders.
 */
export function cardGradientClasses(gradient, seed = '') {
  const h = hash(seed)
  const angle = ANGLE_CLASSES[gradient?.angle]
    ? gradient.angle
    : pick(ANGLES, h)
  const from = FROM_CLASSES[gradient?.from]
    ? gradient.from
    : pick(COLORS, Math.floor(h / ANGLES.length))
  return `${ANGLE_CLASSES[angle]} ${FROM_CLASSES[from]} to-neutral-800`
}
