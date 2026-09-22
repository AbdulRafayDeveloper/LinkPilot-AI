/**
 * The opening some First Message and InMail tones must have: "Hi <first name>, <their sentence>" and then
 * the rest of the message (OPENING_LINES in constants/firstMessage.ts and constants/inmail.ts). A model asked for it usually writes it,
 * but sometimes says the same thing its own way ("thank you for engaging with my post", "I saw you
 * checked out my profile") or the humanizer does, so the opening is checked and put back here. Kept
 * free of the database and of any model, so the rules are testable on their own.
 */

export interface OpeningLine {
  // The exact sentence that follows "Hi <first name>, "
  sentence: string
  // A first sentence that already says the same thing in other words, and is replaced rather than
  // left beside the exact one, so it is never said twice
  restates: RegExp
}

// A first sentence that already thanks them for the post or comment, in whatever words
export const RESTATES_THANKS = /\bthank\w*\b.*\b(?:post|comment|interact|engag|like|react|share)/i
// A first sentence that already mentions the profile view or the accepted request, in whatever words
export const RESTATES_VIEW =
  /\b(?:view|viewed|visited|checked out|looked at|stopped by)\b.*\bprofile\b|\baccept\w*\b.*\b(?:connection|request|invit\w*)|\bthank\w*\b.*\bconnect/i

// "Hi Sara," / "Hello Sara" / "Hey Sara!" at the very start, capturing the name
// (the case is spelled out rather than an `i` flag, which would let \p{Lu} match a lowercase letter)
const GREETING = /^(?:[Hh]i|[Hh]ello|[Hh]ey|[Dd]ear)\s+(\p{Lu}[\p{L}'’-]*)\s*[,.!]?\s*/u
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Whether the message already opens with "Hi <name>, <sentence>". */
export function hasOpeningLine(message: string, { sentence }: OpeningLine): boolean {
  return new RegExp(`^Hi \\p{Lu}[\\p{L}'’-]*, ${escapeRegExp(sentence)}(?:\\s|$)`, "u").test(message.trim())
}

/**
 * The message with its opening made exactly "Hi <name>, <sentence> ". The greeting's name is kept, and
 * a first sentence that already says the same thing (`restates`) is replaced. A message with no
 * greeting to take the name from is returned as it was, and the caller logs it.
 */
export function withOpeningLine(message: string, opening: OpeningLine): { text: string; fixed: boolean } {
  const trimmed = message.trim()
  if (hasOpeningLine(trimmed, opening)) return { text: trimmed, fixed: false }
  const greeting = trimmed.match(GREETING)
  if (!greeting) return { text: trimmed, fixed: false }
  let rest = trimmed.slice(greeting[0].length)
  const [first = ""] = rest.split(SENTENCE_BOUNDARY)
  if (opening.restates.test(first)) rest = rest.slice(first.length).trimStart()
  // What follows starts a new sentence, so it starts with a capital
  rest = rest.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase())
  return { text: `Hi ${greeting[1]}, ${opening.sentence}${rest ? ` ${rest}` : ""}`, fixed: true }
}
