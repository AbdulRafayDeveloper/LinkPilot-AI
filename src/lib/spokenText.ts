/**
 * Adds what was spoken to what is already in a field, within the field's limit. Speaking again
 * adds to the text rather than replacing it, so several takes build one entry. When the result
 * would run past the limit its beginning is kept and the end is left out, never refused, because
 * a refused recording would throw away everything the user just said.
 */
export function appendSpokenText(current: string, spoken: string, maxLength: number): { text: string; skipped: number } {
  const combined = current.trim() ? `${current.trim()}\n${spoken}` : spoken
  return { text: combined.slice(0, maxLength), skipped: Math.max(0, combined.length - maxLength) }
}
