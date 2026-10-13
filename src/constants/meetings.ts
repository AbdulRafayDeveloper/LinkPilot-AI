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
  { id: "recording", label: "Recording", description: "Being recorded and uploaded from the app" },
  { id: "transcribing", label: "Transcribing", description: "The recording is being joined and written out" },
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
// Where several records are linked to one planned meeting, or taken off the one they point at
export const MEETINGS_LINK_ENDPOINT = "/api/meetings/link"

/**
 * The share link one meeting can be sent by (lib/meetingLink.ts): the page whoever receives it
 * opens, and the routes it reads the meeting through. Both are let past the sign-in gate in
 * `src/proxy.ts`, since the signed token in the address is the whole of the caller's authority.
 */
export const PUBLIC_MEETING_PATH = "/meeting"
export const PUBLIC_MEETING_ENDPOINT = "/api/public/meetings"

export const MEETING_LINK_MESSAGES = {
  failed: "Couldn't change the link. Please try again.",
  made: "Link made.",
  replaced: "New link made. The old one stopped working.",
  off: "Link turned off.",
  explains:
    "Whoever has this link can watch the recording and read the summary without signing in. They cannot change anything. New link stops the old one; Turn off stops them all.",
} as const

export const PUBLIC_MEETING_MESSAGES = {
  // Every refusal about the link reads the same, so a guessed token learns nothing
  invalid: "That link doesn't open anything.",
  // On the shared page, so whoever opens it knows there is nothing for them to change
  readOnly: "Shared with you to watch and read",
  // A recorded meeting whose video hasn't been joined yet, or one that was pasted rather than recorded
  noVideo: "There is no video on this meeting.",
  // A meeting shared before its analysis finished: the video is there and the summary follows later
  notAnalysed: "This meeting hasn't been summarised yet.",
} as const

/**
 * Linking a meeting's notes or recording to the planned meeting it was (`meeting_plans`, the
 * calendar in Meeting Planner). One record belongs to at most one planned meeting; a planned
 * meeting may hold several, since a call that ran over two sittings is two records of one event.
 */
export const MEETING_PLAN_LINK_MESSAGES = {
  // On the meetings list, over the ticked rows
  link: "Link to a planned meeting",
  linkOne: "Link to a planned meeting",
  unlink: "Unlink",
  choose: "Which planned meeting was this?",
  chooseHint: "The notes and the recording stay here; the meeting on the calendar will point at them.",
  search: "Search the planned meetings",
  noneToLink: "No meetings on the calendar yet. Add one in Meeting Planner first.",
  noMatch: "No planned meeting matches that search.",
  linked: (count: number) => `${count} ${count === 1 ? "meeting" : "meetings"} linked.`,
  unlinked: (count: number) => `${count} ${count === 1 ? "meeting" : "meetings"} unlinked.`,
  linkFailed: "Couldn't link it. Please try again.",
  unlinkFailed: "Couldn't unlink it. Please try again.",
  // On the calendar, where a planned meeting says what it has
  notesOn: (count: number) => `${count} ${count === 1 ? "record" : "records"}`,
  notesTitle: "Notes and recordings of this meeting",
  notesEmpty: "Nothing is linked to this meeting yet. Link its notes from Meeting Notes to Tasks.",
  openNotes: "Open",
  // The most a single call can link at once, which is what one page of the list holds
  tooMany: "Link up to 50 meetings at a time.",
  // Finding the meeting among everything on the calendar, past and upcoming
  searchHint: "Search by the meeting's name or the person",
  everyOne: "Showing every meeting on the calendar, nearest to today first.",
  repeats: (pattern: string, count: number) => `${pattern} · ${count} ${count === 1 ? "meeting" : "meetings"}`,
  openSeries: "Open the dates of this meeting",
  backToList: "Back to all meetings",
  between: (first: string, last: string) => (first === last ? first : `${first} to ${last}`),
  page: (page: number, pages: number) => `Page ${page} of ${pages}`,
  previousPage: "Back",
  nextPage: "Next",
  chosenIs: "Linking to",
  nothingHere: "No meeting matches these filters.",
  // The month filter, which narrows the list and the dates of one repeating meeting alike
  anyMonth: "Any month",
  monthFilter: "Month",
  inMonth: (label: string, count: number) => `${label} (${count})`,
} as const

/**
 * **Which meetings the picker offers.** The record being linked is usually of a meeting that has
 * just been held, but a meeting written up before it happens is ordinary too (an agenda, a
 * recording of the one before it), so **both past and upcoming are offered** and this narrows them.
 */
export const PLAN_PICK_WHEN = [
  { id: "all", label: "Past and upcoming" },
  { id: "past", label: "Past only" },
  { id: "upcoming", label: "Upcoming only" },
] as const
export type PlanPickWhen = (typeof PLAN_PICK_WHEN)[number]["id"]
export const PLAN_PICK_WHEN_IDS = PLAN_PICK_WHEN.map((entry) => entry.id) as [PlanPickWhen, ...PlanPickWhen[]]

/**
 * A repeating meeting is one meeting per day it happens, so a weekly call filled the picker with
 * the same name over and over. **The list is grouped by series**, one row per name, and this says
 * which kinds of meeting to show at all: the repeating ones (a weekly call), the one-off ones, or
 * both.
 */
export const PLAN_PICK_REPEAT = [
  { id: "all", label: "Repeating and one-off" },
  { id: "repeating", label: "Repeating only" },
  { id: "single", label: "One-off only" },
] as const
export type PlanPickRepeat = (typeof PLAN_PICK_REPEAT)[number]["id"]
export const PLAN_PICK_REPEAT_IDS = PLAN_PICK_REPEAT.map((entry) => entry.id) as [PlanPickRepeat, ...PlanPickRepeat[]]

/** How many rows a page of the picker holds, whether they are meetings or the dates of one series. */
export const PLAN_PICK_PAGE_SIZE = 10
/** Where the picker reads from: the planner's own data, grouped for choosing rather than for a calendar. */
export const PLAN_PICK_ENDPOINT = "/api/meeting-planner/pick"

// How many records one call may link, which is a page of the meetings list
export const MAX_LINKED_AT_ONCE = 50

/**
 * How much room a meeting's own answers get. Measured rather than guessed: one part of a transcript
 * answers in about 4,000 tokens with its reasoning, and the provider's own default cut that off
 * mid-JSON, which it then refused outright. It stays under Groq's free per-minute allowance of
 * 8,000 tokens together with the prompt, because what is **requested** counts towards it.
 */
export const MEETING_ANSWER_MAX_TOKENS = 5000

// How long a step waits when every model is busy for the minute, so the page's loop paces itself
export const BUSY_WAIT_MS = 5_000

export const MEETING_MESSAGES = {
  // Said while every model is rate limited for the minute: the work carries on by itself
  modelBusy: "The models are busy for a moment. This carries on by itself, and nothing already read is lost.",
  missingTranscript: "Paste the meeting notes or transcript first.",
  transcriptTooLong: `A transcript must be under ${(TRANSCRIPT_MAX_LENGTH / 1_000_000).toFixed(0)} million characters.`,
  titleTooLong: `The meeting name must be under ${MEETING_TITLE_MAX_LENGTH} characters.`,
  saved: "Meeting saved. Analysis has started.",
  /**
   * What the minutes say when the recording or the transcript held no meeting at all: someone
   * testing the microphone, a few seconds of a video, a call that never started. The analysis
   * **finishes** and says this, rather than failing, because there being nothing to summarise is an
   * answer about the recording and not a fault in the model that read it.
   */
  nothingDiscussed: "Nothing was discussed in this recording. No topics, decisions or tasks came out of it.",
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
  title: "Meeting Notes to Tasks",
  description: "Understand calls & get tasks",
  icon: CalendarClock,
  href: "/meetings",
  group: "clients",
}
