import { EMBED_PIECE_MAX_CHARS, FIELD_LIMITS, type ProfileField, type ProfileSection } from "@/constants/profileSections"

/**
 * The rules of a My AI Profile entry, read off its section's fields (constants/profileSections.ts) and
 * kept away from the page and the database so they are tested on their own: the form's draft and back,
 * what is still missing, how an entry is named and dated on its card, and the text it is embedded as.
 */

/** Two halves of one "if the client needs X, emphasize Y" line. */
export interface ProfilePair {
  first: string
  second: string
}

export type FieldValue = string | number | boolean | string[] | ProfilePair[] | null
// What an entry holds: one value per field of its section, by the field's key
export type EntryFields = Record<string, FieldValue>
// What the form holds while it is written: a list is the text typed, one item per line
export type EntryDraft = Record<string, string | boolean | string[] | ProfilePair[]>

/** The longest one value of this field may be. */
export function limitOf(field: ProfileField): number {
  if (field.max) return field.max
  switch (field.kind) {
    case "longText":
      return FIELD_LIMITS.longText
    case "url":
      return FIELD_LIMITS.url
    case "lines":
      return FIELD_LIMITS.listItem
    case "chips":
      return FIELD_LIMITS.chip
    case "pairs":
      return FIELD_LIMITS.pair
    default:
      return FIELD_LIMITS.text
  }
}

/** A list typed one item per line: blank lines dropped, each trimmed and cut, each once, at most the list's length. */
export function linesOf(text: string, field: ProfileField): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, limitOf(field)))
    .filter(Boolean)
  return [...new Set(lines)].slice(0, FIELD_LIMITS.listItems)
}

/** Chips typed with commas or pasted as a list: added after the ones there, each once whatever its case. */
export function addChips(current: readonly string[], typed: string, field: ProfileField): string[] {
  const next = [...current]
  for (const word of typed.split(/[,\n]/).map((entry) => entry.trim().slice(0, limitOf(field)))) {
    if (word && !next.some((kept) => kept.toLowerCase() === word.toLowerCase())) next.push(word)
  }
  return next.slice(0, FIELD_LIMITS.chips)
}

const asText = (value: FieldValue | undefined): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")
const asList = (value: FieldValue | undefined): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])
const asPairs = (value: FieldValue | undefined): ProfilePair[] =>
  Array.isArray(value) ? value.filter((item): item is ProfilePair => typeof item === "object" && item !== null && "first" in item) : []

/** A blank form for this section; a list of pairs starts with one empty pair to write in. */
export function emptyDraft(section: ProfileSection): EntryDraft {
  return Object.fromEntries(
    section.fields.map((field) => [field.key, field.kind === "toggle" ? false : field.kind === "chips" ? [] : field.kind === "pairs" ? [{ first: "", second: "" }] : ""])
  )
}

/** A saved entry back in the form, to be edited. */
export function draftOf(section: ProfileSection, fields: EntryFields): EntryDraft {
  return Object.fromEntries(
    section.fields.map((field) => {
      const value = fields[field.key]
      switch (field.kind) {
        case "toggle":
          return [field.key, value === true]
        case "lines":
          return [field.key, asList(value).join("\n")]
        case "chips":
          return [field.key, asList(value)]
        case "pairs": {
          const pairs = asPairs(value)
          return [field.key, pairs.length > 0 ? pairs.map((pair) => ({ ...pair })) : [{ first: "", second: "" }]]
        }
        default:
          return [field.key, asText(value)]
      }
    })
  )
}

/**
 * The form as an entry, ready to send: lists split into items, a pair kept only with both halves, a
 * number read as a number, and a field its toggle clears emptied. The server checks it all again.
 */
export function fieldsOf(section: ProfileSection, draft: EntryDraft): EntryFields {
  const fields: EntryFields = {}
  for (const field of section.fields) {
    const value = draft[field.key]
    switch (field.kind) {
      case "toggle":
        fields[field.key] = value === true
        break
      case "lines":
        fields[field.key] = linesOf(typeof value === "string" ? value : "", field)
        break
      case "chips":
        fields[field.key] = Array.isArray(value) ? (value as string[]).slice(0, FIELD_LIMITS.chips) : []
        break
      case "pairs":
        fields[field.key] = (Array.isArray(value) ? (value as ProfilePair[]) : [])
          .map((pair) => ({ first: pair.first.trim().slice(0, limitOf(field)), second: pair.second.trim().slice(0, limitOf(field)) }))
          .filter((pair) => pair.first && pair.second)
          .slice(0, FIELD_LIMITS.pairs)
        break
      case "number": {
        const text = typeof value === "string" ? value.trim() : ""
        fields[field.key] = text === "" || !Number.isFinite(Number(text)) ? null : Math.round(Number(text))
        break
      }
      default:
        fields[field.key] = typeof value === "string" ? value.trim().slice(0, limitOf(field)) : ""
    }
  }
  for (const field of section.fields) if (field.kind === "toggle" && field.clears && fields[field.key] === true) fields[field.clears] = ""
  return fields
}

/** What is missing before the entry can be saved, or null when it is ready. */
export function entryProblem(section: ProfileSection, fields: EntryFields): string | null {
  const missing = section.fields.find((field) => field.required && asText(fields[field.key]).trim() === "")
  return missing ? `${missing.label} is needed.` : null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2023-01" as "Jan 2023"; anything else as it is. */
export function monthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  return match ? `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}` : value
}

/** What an entry is called on its card and in its embedded text. */
export const entryTitle = (section: ProfileSection, fields: EntryFields): string => asText(fields[section.titleField]).trim() || `Untitled ${section.noun}`

/** The line under the name: the fields that describe it, joined. */
export function entrySubtitle(section: ProfileSection, fields: EntryFields): string {
  return section.subtitleFields
    .map((key) => {
      const field = section.fields.find((entry) => entry.key === key)
      const text = asText(fields[key]).trim()
      return text && field?.key === "rating" ? `${text} of 5` : text
    })
    .filter(Boolean)
    .join(" · ")
}

/** "Jan 2023 to Present", "Mar 2020 to Jun 2022", "Since Jan 2023", "May 2024" or "" when it has no dates. */
export function entryDates(section: ProfileSection, fields: EntryFields): string {
  if (!section.dates) return ""
  const [startKey, endKey, currentKey] = section.dates
  const start = monthLabel(asText(fields[startKey]))
  const end = currentKey && fields[currentKey] === true ? "Present" : endKey ? monthLabel(asText(fields[endKey])) : ""
  if (!endKey) return start
  if (start && end) return `${start} to ${end}`
  if (start) return `Since ${start}`
  return end ? `Until ${end}` : ""
}

const pairLine = (field: ProfileField, pair: ProfilePair): string => {
  const [first, second] = (field.pairLabels ?? ["", ""]).map((label) => label.replace(/\.+$/, "").trim())
  return first ? `${first} ${pair.first}, ${second.charAt(0).toLowerCase()}${second.slice(1)} ${pair.second}` : `${pair.first}: ${pair.second}`
}

/**
 * The entry as the text it is embedded as: the section and the name first, then every field that has
 * something, labelled as the form labels it, so a vector found later reads as a whole thought ("Project:
 * Booking platform. Technologies: Next.js, Stripe") rather than a bare list.
 */
export function entryText(section: ProfileSection, fields: EntryFields): string {
  const lines = [`${section.label}: ${entryTitle(section, fields)}`]
  const subtitle = entrySubtitle(section, fields)
  if (subtitle) lines.push(subtitle)
  const dates = entryDates(section, fields)
  if (dates) lines.push(`Dates: ${dates}`)
  const dateKeys = new Set(section.dates ?? [])
  for (const field of section.fields) {
    if (field.key === section.titleField || section.subtitleFields.includes(field.key) || dateKeys.has(field.key) || field.kind === "toggle") continue
    const value = fields[field.key]
    if (field.kind === "lines") {
      const items = asList(value)
      if (items.length > 0) lines.push(`${field.label}:`, ...items.map((item) => `- ${item}`))
    } else if (field.kind === "chips") {
      const items = asList(value)
      if (items.length > 0) lines.push(`${field.label}: ${items.join(", ")}`)
    } else if (field.kind === "pairs") {
      const pairs = asPairs(value)
      if (pairs.length > 0) lines.push(`${field.label}:`, ...pairs.map((pair) => `- ${pairLine(field, pair)}`))
    } else {
      const text = asText(value).trim()
      if (text) lines.push(`${field.label}: ${text}`)
    }
  }
  return lines.join("\n")
}

/**
 * Text cut into pieces of at most `max` characters, at line ends, so nothing is lost to the
 * embedding model's limit. Every piece after the first starts with the first line again (an entry's
 * name, or "Profile Info"), so each one still says what it is about. A line longer than a piece is cut.
 */
export function piecesOf(text: string, max: number = EMBED_PIECE_MAX_CHARS): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= max) return [trimmed]
  const [heading, ...rest] = trimmed.split("\n")
  const room = Math.max(1, max - heading.length - 1)
  const pieces: string[] = []
  let current: string[] = []
  let size = 0
  const flush = () => {
    if (current.length > 0) pieces.push([heading, ...current].join("\n"))
    current = []
    size = 0
  }
  for (const line of rest.flatMap((entry) => (entry.length > room ? (entry.match(new RegExp(`[\\s\\S]{1,${room}}`, "g")) ?? []) : [entry]))) {
    if (size + line.length + 1 > room) flush()
    current.push(line)
    size += line.length + 1
  }
  flush()
  return pieces.length > 0 ? pieces : [trimmed.slice(0, max)]
}
