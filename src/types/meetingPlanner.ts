import type { MeetingPlanStatusId, PrepStatusId } from "@/constants/meetingPlanner"

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
  // How to move on to the next stage without it feeling like a script
  transition: string
}

/**
 * Finding out whether there is a project here, without pushing for one.
 */
export interface DealPath {
  signals_to_listen_for: string[]
  how_to_raise_scope: string
  natural_next_step: string
}

export interface MeetingPrep {
  lead_analysis: LeadAnalysis
  discussion_topics: DiscussionTopic[]
  conversation_plan: ConversationStage[]
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
  prepEnabled: boolean
  prepStatus: PrepStatusId
  prepError: string | null
  preparedAt: string | null
  createdAt: string
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
