import type { AiSource, WithAiSource } from "./ai"
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
export interface MeetingSummary {
  id: string
  title: string
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
