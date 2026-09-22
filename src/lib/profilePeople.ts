import { normalizeProfileUrl, profileHandle } from "@/lib/linkedinProfile"
import { PERSON_TYPES, PROFILE_SCHEDULER_MESSAGES, type PersonTypeId } from "@/constants/profileScheduler"
import type { ProfileSchedule, ProfileScheduleInput } from "@/types/profileScheduler"

/**
 * People in the Profile Scheduler, read the same way by the page, the edit dialog and the import
 * script (scripts/import-profile-people.mjs): how a person is named, what a form starts from, and
 * how a row of the outreach sheet becomes a person. Nothing here touches the database or the page.
 */

export const EMPTY_PERSON: ProfileScheduleInput = { profileUrl: "", name: "", role: "", location: "", sector: "", types: [], days: [] }

/** The person's name, or the name in their link when none was typed. */
export const personName = (person: Pick<ProfileSchedule, "name" | "profileUrl">) =>
  person.name || (person.profileUrl ? profileHandle(person.profileUrl) : "Unnamed person")

/** What the edit dialog starts from. */
export const inputOf = (person: ProfileSchedule): ProfileScheduleInput => ({
  profileUrl: person.profileUrl ?? "",
  name: person.name,
  role: person.role,
  location: person.location,
  sector: person.sector,
  types: person.types,
  days: person.days,
})

/** The first thing wrong with a form, named before it is sent; the server checks it all again. */
export function personInputProblem(input: ProfileScheduleInput): string | null {
  const link = input.profileUrl.trim()
  if (!link && !input.name.trim()) return PROFILE_SCHEDULER_MESSAGES.missingPerson
  if (link && !normalizeProfileUrl(link)) return PROFILE_SCHEDULER_MESSAGES.badUrl
  if (input.days.length === 0) return PROFILE_SCHEDULER_MESSAGES.missingDays
  return null
}

export const typeLabel = (type: PersonTypeId) => PERSON_TYPES.find((entry) => entry.id === type)?.label ?? type

// ------------------------------------------------------------------ the outreach sheet, as CSV

/** Rows of a CSV file as Excel and Google Sheets write it: commas, quoted cells, doubled quotes, any line ending. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const source = text.replace(/^﻿/, "")
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim()))
}

// The sheet's own headings, read without regard to case, spacing or anything after them
const COLUMNS = { type: /^type/, name: /^name/, role: /^role/, location: /^location/, sector: /^sector/, profileUrl: /^linkedin/ } as const
type Column = keyof typeof COLUMNS

export interface SheetPerson {
  // The row's number in the file, counting the heading as 1, for messages
  line: number
  profileUrl: string | null
  name: string
  role: string
  location: string
  sector: string
  types: PersonTypeId[]
  // What was in the LinkedIn cell when it isn't a profile link ("Search: … (URL not verified)")
  unlinked: string | null
}

export interface SheetReading {
  people: SheetPerson[]
  problems: string[]
}

/** The types in a Type cell: "Signal", "Signal, Reach", "Signal + Referral"... */
export function typesOf(cell: string): { types: PersonTypeId[]; unknown: string[] } {
  const words = cell
    .split(/[,/+&;|]| and /i)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)
  const types = PERSON_TYPES.filter((type) => words.includes(type.id)).map((type) => type.id)
  return { types, unknown: words.filter((word) => !types.includes(word as PersonTypeId)) }
}

/**
 * The people in the outreach sheet, exported as CSV. The heading row must have a Name or a LinkedIn
 * column; the other columns are optional and the rest of the sheet (company, signal, source, notes)
 * is left alone. A row with neither a name nor a link, or a type the list doesn't use, is reported,
 * never guessed at. A LinkedIn cell that isn't a profile link keeps the person, without a link.
 */
export function peopleFromSheet(csv: string): SheetReading {
  const [heading, ...rows] = parseCsv(csv)
  if (!heading) return { people: [], problems: ["The file is empty."] }
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as Column[]).map((column) => [column, heading.findIndex((title) => COLUMNS[column].test(title.trim().toLowerCase()))])
  ) as Record<Column, number>
  if (index.name < 0 && index.profileUrl < 0) {
    return { people: [], problems: ['The first row needs a "Name" or a "LinkedIn" heading.'] }
  }
  const people: SheetPerson[] = []
  const problems: string[] = []
  rows.forEach((cells, position) => {
    const line = position + 2
    const read = (column: Column) => (index[column] >= 0 ? (cells[index[column]] ?? "").replace(/\s+/g, " ").trim() : "")
    const linkCell = read("profileUrl")
    const profileUrl = linkCell ? normalizeProfileUrl(linkCell) : null
    const name = read("name")
    if (!name && !profileUrl) {
      problems.push(`Row ${line}: no name and no LinkedIn profile link, skipped.`)
      return
    }
    const { types, unknown } = typesOf(read("type"))
    if (unknown.length) {
      problems.push(`Row ${line} (${name || linkCell}): "${unknown.join(", ")}" isn't Signal, Reach or Referral, skipped.`)
      return
    }
    people.push({
      line,
      profileUrl,
      name,
      role: read("role"),
      location: read("location"),
      sector: read("sector"),
      types,
      unlinked: linkCell && !profileUrl ? linkCell : null,
    })
  })
  return { people, problems }
}
