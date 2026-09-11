import type {
  ClientSize,
  ConversationReplyPromptId,
  ConversationReplyTypeId,
  RiskLevel,
} from "@/constants/conversationReply"
import type { ConversationParties } from "./conversation"
import type { EditablePrompt } from "./prompts"

export interface ConversationReplyPrompt extends EditablePrompt {
  id: ConversationReplyPromptId
}

export interface ScoreSignal {
  score: number
  summary: string
}

export interface ConversationSignals {
  clientPotential: ScoreSignal
  relationshipStrength: ScoreSignal
  longTermPotential: ScoreSignal
  clientSize: { value: ClientSize; summary: string }
  buyingIntent: ScoreSignal
  conversationMomentum: ScoreSignal
  recipientInterest: ScoreSignal
  decisionMakerLikelihood: ScoreSignal
  opportunityFit: ScoreSignal
  riskLevel: { value: RiskLevel; summary: string }
}

export type ScoreSignalKey = {
  [Key in keyof ConversationSignals]: ConversationSignals[Key] extends ScoreSignal ? Key : never
}[keyof ConversationSignals]

/**
 * The objective read of the conversation. Produced without the reply type or its prompt,
 * so choosing a strategy can never change the scores.
 */
export interface ConversationAnalysis {
  parties: ConversationParties
  signals: ConversationSignals
  keyOpportunities: string[]
  keyRisks: string[]
  recommendedNextMove: string
  overallAssessment: string
}

export interface ConversationReplyResult {
  reply: string
  replyType: ConversationReplyTypeId
  strategyNote: string
  characterCount: number
  warning: string | null
  usedProfile: boolean
  usedSenderProfile: boolean
  analysis: ConversationAnalysis
}
