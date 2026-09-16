import { CalendarClock, type LucideIcon } from "lucide-react"

/**
 * Meeting Understanding & Minutes. A transcript can run to hundreds of thousands of characters,
 * so it is stored first and analyzed afterwards, in chunks, across as many requests as it takes.
 */
export const MEETING_TITLE_MAX_LENGTH = 160
// A 5 hour meeting transcribed at speaking speed is roughly 400,000 characters; this leaves room
export const TRANSCRIPT_MAX_LENGTH = 2_000_000
// One chunk of transcript per analysis call, in characters (roughly 3,000 tokens)
export const CHUNK_MAX_CHARS = 12_000
// The tail of the previous chunk repeated at the top of the next one, so a sentence split across
// two chunks is still understood; it is marked as context and never extracted twice
export const CHUNK_OVERLAP_CHARS = 600
// Chunks analyzed at the same time inside one request
export const CHUNK_CONCURRENCY = 3
// One request analyzes at most this many chunks before answering, so no request runs too long;
// the page calls again and the run continues where it stopped
export const CHUNKS_PER_REQUEST = 6
// How many meetings one page of the history holds
export const MEETINGS_PAGE_SIZE = 20
export const MEETING_SEARCH_MAX_LENGTH = 100
export const SEARCH_DEBOUNCE_MS = 300
// How much of the transcript the detail view shows before "Show the whole transcript"
export const TRANSCRIPT_PREVIEW_CHARS = 4_000

/**
 * Where a meeting is in its analysis. A meeting is saved before anything is analyzed, so the
 * transcript is never at risk, and every later state is recorded on the meeting itself.
 */
export const MEETING_STATUSES = [
  { id: "saved", label: "Saved", description: "Saved, waiting to be analyzed" },
  { id: "analyzing", label: "Analyzing", description: "Reading the transcript chunk by chunk" },
  { id: "summarizing", label: "Generating summary", description: "Putting the whole meeting together" },
  { id: "completed", label: "Completed", description: "Analyzed" },
  { id: "failed", label: "Failed", description: "Analysis stopped; the transcript is safe" },
  { id: "stale", label: "Needs re-analysis", description: "The transcript changed after it was analyzed" },
] as const

export type MeetingStatusId = (typeof MEETING_STATUSES)[number]["id"]

export const MEETING_STATUS_IDS = MEETING_STATUSES.map((status) => status.id) as [MeetingStatusId, ...MeetingStatusId[]]

export const getStatusLabel = (status: MeetingStatusId) =>
  MEETING_STATUSES.find((entry) => entry.id === status)?.label ?? status

// A run is in progress while the status is one of these
export const RUNNING_STATUSES: MeetingStatusId[] = ["analyzing", "summarizing"]

// The two prompts the user can edit, in tab order
export const MEETING_PROMPT_TABS = [
  { id: "chunk", label: "Reading a chunk" },
  { id: "synthesis", label: "Whole meeting" },
] as const

export type MeetingPromptId = (typeof MEETING_PROMPT_TABS)[number]["id"]

export const MEETING_PROMPT_IDS = MEETING_PROMPT_TABS.map((tab) => tab.id) as [MeetingPromptId, ...MeetingPromptId[]]

export const MEETINGS_ENDPOINT = "/api/meetings"

export const MEETING_MESSAGES = {
  missingTranscript: "Paste the meeting notes or transcript first.",
  transcriptTooLong: `A transcript must be under ${(TRANSCRIPT_MAX_LENGTH / 1_000_000).toFixed(0)} million characters.`,
  titleTooLong: `The meeting name must be under ${MEETING_TITLE_MAX_LENGTH} characters.`,
  saved: "Meeting saved. Analysis has started.",
  updated: "Changes saved.",
  deleted: "Meeting deleted.",
  notFound: "That meeting no longer exists.",
  saveFailed: "Couldn't save the meeting. Please try again.",
  loadFailed: "Couldn't load your meetings.",
  moreFailed: "Couldn't load more. Scroll again to retry.",
  deleteFailed: "Couldn't delete the meeting. Please try again.",
  analysisFailed: "The analysis stopped. Your transcript is safe; press Analyse again to carry on.",
  staleAnalysis: "The transcript changed after this was analyzed, so the analysis below is out of date.",
  empty: "No meetings yet. Paste the notes from your next call and the analysis starts by itself.",
  noResults: "No meetings match that search.",
} as const

// The module's sidebar entry
export const MEETINGS_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "meetings",
  title: "Meeting Minutes",
  description: "Understand calls & get tasks",
  icon: CalendarClock,
  href: "/meetings",
  group: "clients",
}
