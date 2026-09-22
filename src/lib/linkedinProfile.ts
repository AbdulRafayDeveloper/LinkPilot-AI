/**
 * LinkedIn profile links, read the same way everywhere: the scheduler's validation, its table and
 * Comment Writer's banner. A link is accepted with or without its scheme, on any LinkedIn host
 * (www, a country's, the mobile one), with anything after the profile's name (a query, a hash, a
 * sub-page such as /recent-activity) dropped, and kept in one form so the same person saved twice
 * is seen as the same profile.
 */

// A profile's public name, read without its escapes: letters of any script, digits, hyphens and underscores
const HANDLE = /^[\p{L}\p{N}\-_]{2,100}$/u

// A name written with escapes (a name in another script) is judged by what they stand for, so an escaped
// "<" or space is refused like the character itself
const decoded = (handle: string) => {
  try {
    return decodeURIComponent(handle)
  } catch {
    return null
  }
}

const LINKEDIN_HOST = /^([a-z0-9-]+\.)?linkedin\.com$/

/** The one form a profile link is kept in, `https://www.linkedin.com/in/<name>`, or null for anything that isn't one. */
export function normalizeProfileUrl(input: string): string | null {
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (!LINKEDIN_HOST.test(url.hostname.toLowerCase())) return null
  const [section, handle] = url.pathname.split("/").filter(Boolean)
  if (section?.toLowerCase() !== "in" || !handle || !HANDLE.test(decoded(handle) ?? "")) return null
  // LinkedIn reads a profile's name without regard to case, so one case keeps duplicates apart
  return `https://www.linkedin.com/in/${handle.toLowerCase()}`
}

/** The name at the end of a kept profile link, as it reads (a name in another script shown in it), for where the whole link is too long. */
export const profileHandle = (profileUrl: string) => {
  const handle = profileUrl.split("/in/")[1] ?? profileUrl
  return decoded(handle) ?? handle
}

/** The profile's posts on LinkedIn, newest first, which is where its comments are written. */
export const profilePostsUrl = (profileUrl: string) => `${profileUrl}/recent-activity/all/`
