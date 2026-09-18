import { normalizeProjectLink } from "@/lib/meetingScript"

/**
 * The link to the person a meeting is with. It is kept on the meeting so the page can open their
 * profile during the call, the same way a project's link opens a project.
 *
 * A profile is usually pasted in whole, with the address somewhere inside it, so the link can be
 * read out of what was pasted instead of being typed a second time. Only the first address that
 * looks like a profile is taken, and the user can always overwrite it.
 */

// A bare web address inside pasted text. Trailing punctuation is left out, since a profile pasted
// mid-sentence often ends "…/in/omar-siddiqui)." and the brackets are not part of the address
const LINK_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/gi
// A www address typed without the scheme, which is how a profile is often copied out of a browser
const BARE_WWW_IN_TEXT = /(?:^|\s)(www\.[^\s<>"'`]+)/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>"']+$/

// The places a person's profile actually lives, best first, so a link to their company's blog in
// the same paste never beats a link to the person
const PROFILE_HOSTS = [
  /(^|\.)linkedin\.com$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)dribbble\.com$/i,
  /(^|\.)behance\.net$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)upwork\.com$/i,
]

const hostOf = (link: string): string | null => {
  try {
    return new URL(link).hostname
  } catch {
    return null
  }
}

/** How good a match this address is for "the person's profile"; higher wins, 0 means not one. */
function profileRank(link: string): number {
  const host = hostOf(link)
  if (!host) return 0
  const known = PROFILE_HOSTS.findIndex((pattern) => pattern.test(host))
  // A known profile host, best first; anything else is still a usable link, just ranked below them
  if (known !== -1) return PROFILE_HOSTS.length - known + 1
  return 1
}

/** Every web address in some pasted text, tidied and in the order they appear. */
function linksIn(text: string): string[] {
  const found = [...(text.match(LINK_IN_TEXT) ?? [])]
  for (const match of text.matchAll(BARE_WWW_IN_TEXT)) found.push(match[1])
  return found.map((link) => normalizeProjectLink(link.replace(TRAILING_PUNCTUATION, ""))).filter((link) => hostOf(link) !== null)
}

/**
 * The profile address inside a pasted profile, or "" when there is none. A LinkedIn or GitHub
 * address wins over a plain website; otherwise the first one wins, which is how a pasted profile
 * usually leads with the person's own page.
 */
export function findProfileLink(text: string | null | undefined): string {
  if (!text?.trim()) return ""
  let best = ""
  let bestRank = 0
  for (const link of linksIn(text)) {
    const rank = profileRank(link)
    if (rank > bestRank) {
      best = link
      bestRank = rank
    }
  }
  return best
}

/** A profile link as typed ("linkedin.com/in/omar") made into a web address; blank stays blank. */
export const normalizeProfileLink = normalizeProjectLink

/** Whether a normalized profile link is one the page will actually open. */
export const isUsableProfileLink = (link: string): boolean => {
  const host = hostOf(link)
  return host !== null && /^https?:$/i.test(new URL(link).protocol)
}
