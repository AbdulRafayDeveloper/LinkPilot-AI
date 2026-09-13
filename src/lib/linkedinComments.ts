/**
 * Best-effort detection of the original post excerpt and the individual comments in text
 * pasted from LinkedIn. Post Comment Replies uses it to find the other person's latest comment
 * to answer; the model always receives the full pasted text too, so input this parser can't
 * structure still works.
 *
 * Two formats are recognized:
 * - Labelled: "Name: comment" (or "Name:" on its own line), optionally under
 *   "Original post:" / "Comments:" headers.
 * - LinkedIn's own copy format: name, connection degree ("• 2nd"), headline, age ("3h"),
 *   comment text, then "Like" / "Reply".
 */

export interface DetectedComment {
  // Derived from author and text, so a selection survives re-parsing while the comment is unchanged
  key: string
  author: string | null
  text: string
}

export interface ParsedConversation {
  postExcerpt: string | null
  comments: DetectedComment[]
}

interface RawComment {
  author: string | null
  lines: string[]
}

const MAX_NAME_LENGTH = 60
const MAX_NAME_WORDS = 5
// Lowercase words allowed inside a name, e.g. "Ludwig van Beethoven", "Ahmed bin Ali"
const NAME_PARTICLES = new Set(["al", "bin", "bint", "da", "de", "del", "della", "der", "di", "dos", "du", "el", "ibn", "la", "le", "van", "von"])
// Capitalized labels that look like "Name:" but aren't commenters
const NON_NAME_LABELS = new Set([
  "a", "answer", "comment", "comments", "edit", "example", "link", "note", "ps", "p.s.", "post", "q", "question",
  "re", "replies", "reply", "source", "summary", "tl;dr", "tldr", "update",
])
const NAME_WORD = /^[\p{L}\p{M}'’.-]+$/u
const CAPITALIZED_WORD = /^[\p{Lu}\p{Lt}\p{Lo}]/u

const POST_HEADER = /^\s*(?:original\s+post|my\s+post|their\s+post|the\s+post|post)\s*:\s*(.*)$/i
const COMMENTS_HEADER = /^\s*(?:comments?|replies|comment\s+thread)\s*(?:\(\s*\d[\d,]*\s*\))?\s*:?\s*$/i
const LABELLED_LINE = /^\s*(?:[-*•]\s+)?@?([^:]{1,60}?)\s*(?:\([^)]{1,40}\))?\s*:\s*(.*)$/

const DEGREE_LINE = /^\s*(?:[•·]\s*)?(?:1st|2nd|3rd\+?|author|you)\s*$/i
const INLINE_DEGREE = /^\s*(.{1,60}?)\s*[•·]\s*(?:1st|2nd|3rd\+?|author|you)\s*$/i
const AGE_LINE = /^\s*(?:\d{1,2}\s*(?:s|m|min|mins|h|hr|hrs|d|w|mo|y|yr|yrs)|now|just now)\b\s*(?:[•·]\s*)?(?:\(?edited\)?)?\s*[•·]?\s*$/i
const PROFILE_LINE = /^\s*view\s+.+['’]s?\s+profile\s*$/i
const INTERFACE_LINE =
  /^\s*(?:like|reply|comment|repost|send|share|report|follow|\+\s*follow|see more|see translation|…\s*more|\.\.\.\s*more|load more comments|load previous replies|see previous replies|most relevant|most recent|add a comment…?|\(?edited\)?|\d[\d,]*|\d[\d,]*\s+(?:reactions?|likes?|repl(?:y|ies)|comments?|reposts?)|like\s*[·|•]\s*reply.*|view\s+.+['’]s?\s+profile)\s*$/i
// Actions under a post (not under a comment) mark a block as the original post
const POST_ACTION_LINE = /^\s*(?:repost|send|\d[\d,]*\s+comments?|\d[\d,]*\s+reposts?)\s*$/i

function isPlausibleName(raw: string): boolean {
  const name = raw.trim()
  if (!name || name.length > MAX_NAME_LENGTH || NON_NAME_LABELS.has(name.toLowerCase())) return false
  const words = name.split(/\s+/)
  if (words.length > MAX_NAME_WORDS) return false
  const isNameWord = (word: string) => NAME_WORD.test(word) && (CAPITALIZED_WORD.test(word) || NAME_PARTICLES.has(word.toLowerCase()))
  return words.every(isNameWord) && words.some((word) => CAPITALIZED_WORD.test(word))
}

function joinText(lines: string[]): string {
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function toPostExcerpt(lines: string[]): string | null {
  const firstIndex = lines.findIndex((line) => line.trim())
  if (firstIndex < 0) return null
  const header = lines[firstIndex].match(POST_HEADER)
  const body = header ? [header[1], ...lines.slice(firstIndex + 1)] : lines.slice(firstIndex)
  return joinText(body) || null
}

function toDetectedComments(raw: RawComment[]): DetectedComment[] {
  const seen = new Map<string, number>()
  return raw.flatMap(({ author, lines }) => {
    const text = joinText(lines)
    if (!text) return []
    const baseKey = `${author ?? ""}\u241f${text}`
    const occurrence = seen.get(baseKey) ?? 0
    seen.set(baseKey, occurrence + 1)
    return [{ key: occurrence ? `${baseKey}#${occurrence}` : baseKey, author, text }]
  })
}

function parseLabelled(lines: string[]): ParsedConversation {
  const headerIndex = lines.findIndex((line) => COMMENTS_HEADER.test(line))
  const hasCommentsHeader = headerIndex >= 0
  const region = hasCommentsHeader ? lines.slice(headerIndex + 1) : lines

  const comments: RawComment[] = []
  const leading: string[] = []
  for (const line of region) {
    const match = line.match(LABELLED_LINE)
    if (match && isPlausibleName(match[1])) {
      comments.push({ author: match[1].trim(), lines: [match[2]] })
    } else if (comments.length > 0) {
      comments[comments.length - 1].lines.push(line)
    } else {
      leading.push(line)
    }
  }

  if (hasCommentsHeader) {
    // Under an explicit "Comments:" header, text before the first name is an unnamed comment
    if (joinText(leading)) comments.unshift({ author: null, lines: leading })
    return { postExcerpt: toPostExcerpt(lines.slice(0, headerIndex)), comments: toDetectedComments(comments) }
  }
  if (comments.length === 0) return { postExcerpt: null, comments: [] }
  return { postExcerpt: toPostExcerpt(leading), comments: toDetectedComments(comments) }
}

interface NativeBlock {
  author: string
  // First line of the block (the author's name, including LinkedIn's repeated name line)
  start: number
  // The connection-degree line that identified the block
  marker: number
}

function findNativeBlocks(lines: string[]): NativeBlock[] {
  const blocks: NativeBlock[] = []
  lines.forEach((line, index) => {
    const floor = blocks.length > 0 ? blocks[blocks.length - 1].marker : -1
    const inline = line.match(INLINE_DEGREE)
    if (inline && isPlausibleName(inline[1])) {
      blocks.push({ author: inline[1].trim(), start: index, marker: index })
      return
    }
    if (!DEGREE_LINE.test(line)) return

    let cursor = index - 1
    while (cursor > floor && (!lines[cursor].trim() || PROFILE_LINE.test(lines[cursor]))) cursor--
    if (cursor <= floor || !isPlausibleName(lines[cursor])) return
    const author = lines[cursor].trim()

    // LinkedIn repeats the name (and a "View X's profile" line) for screen readers
    let start = cursor
    while (
      start - 1 > floor &&
      (!lines[start - 1].trim() || lines[start - 1].trim() === author || PROFILE_LINE.test(lines[start - 1]))
    ) {
      start--
    }
    blocks.push({ author, start, marker: index })
  })
  return blocks
}

function blockText(lines: string[], block: NativeBlock, end: number): string[] {
  let cursor = block.marker + 1
  // The headline and age follow the degree line; the age reliably ends the metadata
  const upcoming: number[] = []
  for (let index = cursor; index < end && upcoming.length < 2; index++) {
    if (lines[index].trim()) upcoming.push(index)
  }
  const ageIndex = upcoming.find((index) => AGE_LINE.test(lines[index]))
  if (ageIndex !== undefined) cursor = ageIndex + 1

  return lines
    .slice(cursor, end)
    .filter((line) => !INTERFACE_LINE.test(line) && !AGE_LINE.test(line) && !DEGREE_LINE.test(line))
}

function parseNative(lines: string[]): ParsedConversation | null {
  const blocks = findNativeBlocks(lines)
  if (blocks.length === 0) return null

  let postLines = lines.slice(0, blocks[0].start)
  const comments: RawComment[] = []
  blocks.forEach((block, index) => {
    const end = index + 1 < blocks.length ? blocks[index + 1].start : lines.length
    const region = lines.slice(block.marker + 1, end)
    // The first block is the post itself when its footer has post actions (Repost, Send, "12 comments")
    if (index === 0 && region.some((line) => POST_ACTION_LINE.test(line))) {
      postLines = blockText(lines, block, end)
      return
    }
    comments.push({ author: block.author, lines: blockText(lines, block, end) })
  })

  const detected = toDetectedComments(comments)
  if (detected.length === 0) return null
  const cleanPost = postLines.filter((line) => !INTERFACE_LINE.test(line) && !AGE_LINE.test(line))
  return { postExcerpt: toPostExcerpt(cleanPost), comments: detected }
}

export function parseLinkedInConversation(input: string): ParsedConversation {
  // LinkedIn copies often contain non-breaking spaces
  const lines = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n")
  return parseNative(lines) ?? parseLabelled(lines)
}
