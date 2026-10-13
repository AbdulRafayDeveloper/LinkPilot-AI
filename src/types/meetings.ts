import type { AiSource, WithAiSource } from "./ai"
import type { MeetingRecordingSummary } from "./meetingRecording"
import type { MeetingStatusId } from "@/constants/meetings"

/**
 * How sure the analysis is about a fact: the transcript said it, the transcript implies it, or
 * it could not be worked out at all. Nothing is ever invented to fill a gap.
 */
export type Evidence = "stated" | "inferred"

export interface MeetingParticipant {
  // The name as the transcript gives it, or a label such as "Unnamed speaker 2"
  name: string
  // What they were doing in the meeting, when the transcript says so
  role: string | null
  isNamed: boolean
  evidence: Evidence
}

export interface ActionItem {
  task: string
  // Who agreed to do it, or null when the transcript does not say
  owner: string | null
  // Only when a date or deadline was actually said
  deadline: string | null
  evidence: Evidence
}

export interface MeetingDecision {
  decision: string
  evidence: Evidence
}

/**
 * Everything the analysis produces for one meeting. Abdul Rafay's own work is separated from the
 * meeting as a whole, because that is what he acts on first.
 */
export interface MeetingAnalysis {
  purpose: string | null
  topics: string[]
  participants: MeetingParticipant[]
  participantCount: number
  // What Abdul Rafay is expected to do
  myTasks: ActionItem[]
  // What the client asked him for
  clientRequests: string[]
  // Decisions that involve him
  myDecisions: MeetingDecision[]
  decisions: MeetingDecision[]
  actionItems: ActionItem[]
  // The 3 to 4 line message to send the client
  minutes: string
  // What the transcript simply does not answer
  unknowns: string[]
}

export interface MeetingProgress {
  analyzedChunks: number
  totalChunks: number
}

/**
 * One meeting in the history list: enough to show a card, without its transcript.
 */
/**
 * A planned meeting, as little of it as naming it takes: what a linked record says it belongs to.
 */
export interface MeetingPlanRef {
  id: string
  name: string
  meetingDate: string
  meetingTime: string
}

/** One record linked to a planned meeting, as the calendar's popup lists it. */
export interface LinkedMeeting {
  id: string
  title: string
  status: string
  // Whether it was recorded in the app, so the popup says "recording" rather than "notes"
  hasRecording: boolean
  transcriptChars: number
  createdAt: string
}

export interface MeetingSummary {
  id: string
  title: string
  /**
   * The planned meeting this is the record of, when it has been linked to one: its id and enough
   * of it to name it in a list. Null for a meeting linked to nothing, which is every meeting until
   * someone links it.
   */
  plan?: { id: string; name: string; meetingDate: string; meetingTime: string } | null
  // Whether it was recorded in the app, so a list can say "recording" rather than "notes"
  hasRecording?: boolean
  isTitleGenerated: boolean
  status: MeetingStatusId
  statusMessage: string | null
  transcriptChars: number
  participantCount: number | null
  purpose: string | null
  progress: MeetingProgress
  createdAt: string
  updatedAt: string
}

/**
 * One meeting opened on its own: the summary, the transcript it was built from, and the analysis.
 */
export interface Meeting extends MeetingSummary {
  transcript: string
  analysis: MeetingAnalysis | null
  // True when the transcript was edited after the analysis was made
  isAnalysisStale: boolean
  analyzedAt: string | null
  // Who wrote the analysis, over every call that built it
  analysisSource: AiSource
  // The editable notes built from the analysis; "" until there is one
  notes: string
  notesEditedAt: string | null
  // Set for a meeting recorded in the app, null for a pasted one
  recording: MeetingRecordingSummary | null
  // The token of the share link that is on, or null when there is none (lib/meetingLink.ts)
  publicToken: string | null
}

/**
 * What a meeting's share link opens, for someone who is not signed in: the recording to watch and
 * what the analysis made of it. **Read only**, and deliberately less than the owner sees: no
 * transcript, no chat, no notes to edit, and nothing that says whose account the meeting is.
 */
export interface PublicMeeting {
  title: string
  // When it was recorded or saved, and how long the recording runs
  createdAt: string
  durationMs: number | null
  hasVideo: boolean
  // The summary to send on, "" until there is an analysis
  minutes: string
  // The notes built from the analysis and edited by the owner, "" when there are none
  notes: string
  analysis: MeetingAnalysis | null
}

export interface MeetingsPage {
  meetings: MeetingSummary[]
  nextCursor: string | null
  total: number
}

export interface MeetingInput {
  title?: string
  transcript: string
}

export interface MeetingRunState extends WithAiSource {
  status: MeetingStatusId
  statusMessage: string | null
  progress: MeetingProgress
  // True while there is more work to do, so the page calls again
  hasMore: boolean
}
