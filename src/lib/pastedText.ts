/**
 * Text copied off a LinkedIn page, with the page left out.
 *
 * Selecting a profile and copying it brings the whole page along: the navigation bar, the buttons
 * under every post, "· 2nd" on every line that names the person, and hundreds of blank lines. None
 * of it says anything about the person, and all of it is paid for by the token. A full profile
 * pasted that way was about a third chrome, and together with the sender's own profile it ran past
 * the per-minute token ceiling of every Groq key, so the tones that use both could not be written.
 *
 * LinkedIn's "bold" (𝗦𝗼𝗳𝘁𝘄𝗮𝗿𝗲, Unicode Mathematical letters) is read as plain letters too: a model
 * reads it as several tokens a letter, and the words are what it needs. Nothing a person wrote is
 * removed, only lines that are exactly a piece of the page.
 */

// Lines that are exactly one of LinkedIn's own labels or buttons
const PAGE_LABELS = new Set([
  "Home",
  "My Network",
  "Jobs",
  "Messaging",
  "Notifications",
  "Me",
  "For Business",
  "Hire with AI",
  "Search",
  "Cover photo",
  "Contact info",
  "Connect",
  "Message",
  "More",
  "Follow",
  "Following",
  "View image",
  "Show all",
  "Show more",
  "Show less",
  "See more",
  "… more",
  "...more",
  "Like",
  "Comment",
  "Repost",
  "Send",
  "Reply",
  "View all paths",
  "View 2 signals",
  "Retry Sales Navigator",
  "Cancel anytime. No hidden fees.",
  "·",
  "•",
])

const PAGE_LINES = [
  // The degree of connection on its own line: "· 2nd", "• 3rd+"
  /^[·•]\s*(?:1st|2nd|3rd\+?)$/,
  /^\d+ notifications?$/i,
  // The link around the author's name on every post: "View Abdul's profile"
  /^View .{1,80}[’']s? profile$/,
  /^View \d+ signals?$/i,
]

const isPageChrome = (line: string) => PAGE_LABELS.has(line) || PAGE_LINES.some((pattern) => pattern.test(line))

/**
 * Marks a prompt block as text the user pasted, the one part of a request that may be shortened when
 * it would not otherwise fit a provider's per-minute ceiling. The tag sanitizer strips every tag of a
 * block's name from the content, attributes and all, so pasted text can never mark itself.
 */
export const PASTED_SOURCE = 'source="pasted"'
const PASTED_BLOCK = /<([a-z_]+) source="pasted">\n([\s\S]*?)\n<\/\1>/g
// What pasted text always keeps: the person's name, headline and About come first on a profile
const MIN_PASTED_CHARS = 1_500
// The headings that follow Activity on a LinkedIn profile, so its end can be found
const AFTER_ACTIVITY = new Set([
  "Experience",
  "Education",
  "Licenses & certifications",
  "Skills",
  "Projects",
  "Volunteering",
  "Honors & awards",
  "Languages",
  "Recommendations",
  "Interests",
  "Courses",
  "Publications",
  "Organizations",
])

// The end of the text cut at a line, so no line is left half written
const cutAt = (text: string, maxChars: number) => {
  const head = text.slice(0, Math.max(0, maxChars))
  const end = head.lastIndexOf("\n")
  return (end > maxChars / 2 ? head.slice(0, end) : head).trimEnd()
}

/**
 * Pasted text brought down to `maxChars`, losing what matters least first: the oldest posts of a
 * profile's Activity (posts are listed newest first, and news such as a funding round is recent),
 * then the end of the text. Never below `MIN_PASTED_CHARS`, so the person is always still there.
 */
export function shortenPastedText(text: string, maxChars: number, leftOut: string): string {
  const target = Math.max(maxChars, MIN_PASTED_CHARS)
  if (text.length <= target) return text
  const lines = text.split("\n")
  const start = lines.indexOf("Activity")
  const next = start < 0 ? -1 : lines.findIndex((line, index) => index > start && AFTER_ACTIVITY.has(line))
  let shorter = text
  if (next > start + 1) {
    const before = lines.slice(0, start + 1).join("\n")
    const activity = lines.slice(start + 1, next).join("\n")
    const after = lines.slice(next).join("\n")
    const keep = Math.max(0, activity.length - (text.length - target))
    shorter = [before, keep > 0 ? cutAt(activity, keep) : "", after].filter(Boolean).join("\n")
  }
  return shorter.length <= target ? shorter : `${cutAt(shorter, target - leftOut.length - 1)}\n${leftOut}`
}

/**
 * A prompt with about `removeChars` fewer characters of pasted text, taken from each pasted block in
 * proportion to its length. Null when there is no pasted text left that may be shortened.
 */
export function shrinkPastedBlocks(prompt: string, removeChars: number, leftOut: string): string | null {
  const blocks = [...prompt.matchAll(PASTED_BLOCK)]
  const total = blocks.reduce((sum, match) => sum + match[2].length, 0)
  if (total === 0 || removeChars <= 0) return null
  let changed = false
  const shorter = prompt.replace(PASTED_BLOCK, (whole, tag: string, body: string) => {
    const shortened = shortenPastedText(body, body.length - Math.ceil((removeChars * body.length) / total), leftOut)
    if (shortened === body) return whole
    changed = true
    return `<${tag} ${PASTED_SOURCE}>\n${shortened}\n</${tag}>`
  })
  return changed ? shorter : null
}

export function tidyPastedText(text: string): string {
  const kept: string[] = []
  for (const raw of text.normalize("NFKC").split(/\r?\n/)) {
    const line = raw.trim()
    if (isPageChrome(line)) continue
    const previous = kept.at(-1)
    // One blank line between blocks is enough, and a line copied twice in a row says nothing new
    if (line === "" ? previous === "" || previous === undefined : line === previous) continue
    kept.push(line)
  }
  return kept.join("\n").trim()
}
