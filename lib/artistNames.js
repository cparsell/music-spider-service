// Cleanup for artist names pasted into the Custom List / Ignore List boxes.
// Text copied from a page, spreadsheet or document can carry invisible
// characters that a plain trim() leaves in: tabs and non-breaking spaces
// from table cells, zero-width characters, a byte-order mark, bullet
// prefixes from lists, and mixed line endings.
//
// Characters are classified by code point (rather than a regex character
// class) so the invisible ones are spelled out as numbers, not left as
// characters nobody can see in the source.

// Soft hyphen, zero-width space/joiners, directional marks, word joiner, BOM -
// invisible, but they make "Air" and "Air" two different strings.
const isInvisible = c =>
  c === 0xad ||
  (c >= 0x200b && c <= 0x200f) ||
  (c >= 0x202a && c <= 0x202e) ||
  c === 0x2060 ||
  (c >= 0x2066 && c <= 0x2069) ||
  c === 0xfeff

// Tabs and every kind of unicode space (NBSP, thin/em spaces, ideographic
// space, line/paragraph separators...), all turned into a plain space.
const isOddSpace = c =>
  c === 0x09 ||
  c === 0x0b ||
  c === 0x0c ||
  c === 0xa0 ||
  c === 0x1680 ||
  (c >= 0x2000 && c <= 0x200a) ||
  c === 0x2028 ||
  c === 0x2029 ||
  c === 0x202f ||
  c === 0x205f ||
  c === 0x3000

// Other control characters (newlines are split on before this runs).
const isControl = c => c <= 0x08 || (c >= 0x0e && c <= 0x1f) || c === 0x7f

// A leading bullet/dash marker from a copied list ("• Air", "- Air", "* Air").
// Numbered prefixes aren't stripped: names like "2Pac" or "10cc" start with
// digits, and "1. FC Köln" would be damaged.
const LIST_MARKER = /^[-*•·▪▫‣●○◦–—]\s+/

/**
 * Cleans a single artist name. Returns '' if nothing usable is left.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeArtistName(name) {
  if (name == null) return ''
  let out = ''
  for (const ch of String(name).normalize('NFC')) {
    const code = ch.codePointAt(0)
    if (isInvisible(code) || isControl(code)) continue
    out += isOddSpace(code) ? ' ' : ch
  }
  return out.replace(/\s+/g, ' ').trim().replace(LIST_MARKER, '').trim()
}

/**
 * Splits pasted text (one artist per line) into clean, de-duplicated names,
 * keeping the first spelling of each (compared case-insensitively).
 * @param {string|string[]} input a block of text, or an array of names
 * @returns {string[]}
 */
export function parseArtistNames(input) {
  const lines = Array.isArray(input)
    ? input
    : String(input ?? '').split(/\r\n|\r|\n/)
  const seen = new Set()
  const names = []
  for (const line of lines) {
    const clean = sanitizeArtistName(line)
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(clean)
  }
  return names
}
