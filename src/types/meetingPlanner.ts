import type { MeetingPlanStatusId, PrepStatusId, RecurrencePatternId, ScriptStepKindId } from "@/constants/meetingPlanner"
import type { WithAiSource } from "./ai"

/**
 * Whether the model read something the user supplied, or worked it out from what was supplied.
 * The same distinction the meeting-minutes module makes, so nothing inferred ever reads as fact.
 */
export type Evidence = "stated" | "inferred"

export interface LeadObservation {
  point: string
  evidence: Evidence
}

/**
 * What can be said about the person from the information the user supplied, and nothing else.
 */
export interface LeadAnalysis {
  who_they_are: string
  background: string
  interests: LeadObservation[]
  needs_and_opportunities: LeadObservation[]
  how_you_can_help: string[]
  before_you_join: string[]
  // What nobody knows yet, so the user asks instead of assuming
  open_questions: string[]
}

export interface DiscussionTopic {
  topic: string
  why_it_matters: string
  evidence: Evidence
}

/**
 * One stage of the conversation, in the order it happens.
 */
export interface ConversationStage {
  stage: string
  goal: string
  what_to_say: string
  questions: string[]
  // What has to have been heard or agreed before this stage is done (missing on preparations written before it existed)
  move_on_when?: string
  // The sentence that moves the conversation on to the next stage
  transition: string
}

/**
 * One thing to do on the call. `text` may carry the rich text marks (`lib/richText.ts`). A
 * show_project step also names the project, roughly how many minutes to spend on it and the
 * features to show; the other kinds leave those empty.
 */
export interface ScriptStep {
  id: string
  kind: ScriptStepKindId
  text: string
  project: string
  minutes: number
  features: string[]
}

/** One stage of the conversation script, its steps in the order they happen. */
export interface ScriptStage {
  id: string
  title: string
  goal: string
  steps: ScriptStep[]
  move_on_when: string
}

/**
 * Why the meeting exists, which decides everything else: a project they brought, or work I offered.
 */
export type MeetingSituation = "they_asked_for_a_project" | "you_reached_out" | "unclear"

export interface MeetingContext {
  situation: MeetingSituation
  what_it_is_about: string
}

/**
 * One of the user's own projects worth showing this person, and why it will matter to them. The
 * user can add their own, with a link to open during the call; ids and links are missing on
 * preparations written before projects could be edited.
 */
export interface ProjectToShow {
  id?: string
  project: string
  why_it_will_land: string
  link?: string
  // Added or edited by the user: kept, with its link, when the preparation is written again
  added_by_user?: boolean
}

/**
 * Finding out whether there is a project here, without pushing for one.
 */
export interface DealPath {
  signals_to_listen_for: string[]
  how_to_raise_scope: string
  natural_next_step: string
}

export interface MeetingPrep extends WithAiSource {
  // The next three are missing on preparations written before they existed, which still open as they were
  meeting_context?: MeetingContext
  projects_to_show?: ProjectToShow[]
  your_intro?: string
  lead_analysis: LeadAnalysis
  discussion_topics: DiscussionTopic[]
  // The script, as written and then as the user edited it. Preparations written before scripts
  // existed have conversation_plan instead, which `conversationOf` reads as a script
  conversation?: ScriptStage[]
  conversation_edited_at?: string
  conversation_plan?: ConversationStage[]
  deal_path: DealPath
  // Things the user should not claim, because no source backs them
  cautions: string[]
}

/**
 * One meeting, as the API serves it.
 */
export interface MeetingPlan {
  id: string
  name: string
  // The day and wall-clock time the user chose (YYYY-MM-DD and HH:mm)
  meetingDate: string
  meetingTime: string
  status: MeetingPlanStatusId
  completedAt: string | null
  personName: string | null
  // Their profile address, when one was typed or found in the pasted profile
  profileLink: string | null
  prepEnabled: boolean
  prepStatus: PrepStatusId
  prepError: string | null
  preparedAt: string | null
  // Set on every meeting of a repeating series, null on a one-off meeting
  seriesId: string | null
  recurrencePattern: RecurrencePatternId | null
  recurrenceUntil: string | null
  createdAt: string
}

/** How a new meeting repeats: the pattern, and the last day the series may meet on. */
export interface MeetingRecurrence {
  pattern: RecurrencePatternId
  until: string
}

/**
 * One meeting with everything saved on it: the preparation inputs and the generated preparation.
 * Only the detail view needs this much.
 */
export interface MeetingPlanDetail extends MeetingPlan {
  profileInfo: string | null
  conversationHistory: string | null
  additionalInfo: string | null
  prep: MeetingPrep | null
  // How many meetings its series still holds, this one included; only the meeting's own GET and a
  // new series carry it, since counting it costs a query
  seriesSize?: number
}

/**
 * What the planner page shows at once: one month for the calendar, today's meetings whatever
 * month is on screen, and the counts the headings need.
 */
export interface MeetingPlannerPage {
  month: string
  meetings: MeetingPlan[]
  today: MeetingPlan[]
  todayDate: string
  pendingToday: number
}
