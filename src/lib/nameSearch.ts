/**
 * Searching a short list of names as the user types: every word typed must appear somewhere in the
 * name, in any order and whatever the case, so "client note" finds "Notes for clients". A blank
 * query matches everything, which is what lets a search box start with the whole list on show.
 */

export const matchesWords = (text: string, query: string): boolean => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = text.toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/** The items whose text matches, in the order they were given, so a list never reshuffles as it narrows. */
export const filterByWords = <T>(items: readonly T[], query: string, textOf: (item: T) => string): T[] =>
  items.filter((item) => matchesWords(textOf(item), query))
