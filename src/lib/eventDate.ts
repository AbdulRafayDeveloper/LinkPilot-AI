const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/**
 * Whole UTC days between an ISO date (YYYY-MM-DD) and today.
 */
export function daysSince(eventDate: string, now: Date): number {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((todayUtc - Date.parse(`${eventDate}T00:00:00Z`)) / DAY_MS)
}

/**
 * Ways a source or report can state a date: ISO, written out in full or abbreviated (including
 * the AP style most outlets use), or as a URL path segment.
 */
function dateEvidencePatterns(year: string, month: string, day: string): string[] {
  const monthName = MONTHS[Number(month) - 1]
  const dayNumber = String(Number(day))
  const short = monthName.slice(0, 3)
  return [
    `${year}-${month}-${day}`,
    `${year}/${month}/${day}`,
    `${monthName} ${dayNumber}, ${year}`,
    `${monthName} ${dayNumber} ${year}`,
    `${short} ${dayNumber}, ${year}`,
    // AP style, which reputable outlets use: Sept. 12, 2026
    `${short}. ${dayNumber}, ${year}`,
    `${monthName.slice(0, 4)} ${dayNumber}, ${year}`,
    `${monthName.slice(0, 4)}. ${dayNumber}, ${year}`,
    `${dayNumber} ${monthName} ${year}`,
    `${dayNumber} ${short} ${year}`,
    `/${year}/${month}/${day}/`,
    `/${year}/${month}/${day}`,
  ].map((pattern) => pattern.toLowerCase())
}

/**
 * Accepts an event date only if it is a real calendar date stated in the (lowercased)
 * evidence text, isn't in the future, and is no older than maxAgeDays.
 */
export function verifyEventDate(value: string | null, now: Date, evidence: string, maxAgeDays: number): string | null {
  const match = value?.trim().match(ISO_DATE)
  if (!match) return null
  const [, year, month, day] = match
  if (!dateEvidencePatterns(year, month, day).some((pattern) => evidence.includes(pattern))) return null
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day))
  if (new Date(timestamp).toISOString().slice(0, 10) !== match[0]) return null
  const age = daysSince(match[0], now)
  return age >= -1 && age <= maxAgeDays ? match[0] : null
}
