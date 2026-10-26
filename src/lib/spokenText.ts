/**
 * Adds what was spoken to what is already in a field, within the field's limit. Speaking again
 * adds to the text rather than replacing it, so several takes build one entry. When the result
 * would run past the limit its beginning is kept and the end is left out, never refused, because
 * a refused recording would throw away everything the user just said.
 *
 * `separator` is what goes between the two: a new line in a plain text box, and a blank line in a
 * formatted one (a Quick Note), where a single new line would run the take into the paragraph above.
 */
export function appendSpokenText(current: string, spoken: string, maxLength: number, separator = "\n"): { text: string; skipped: number } {
  const combined = current.trim() ? `${current.trim()}${separator}${spoken}` : spoken
  return { text: combined.slice(0, maxLength), skipped: Math.max(0, combined.length - maxLength) }
}
