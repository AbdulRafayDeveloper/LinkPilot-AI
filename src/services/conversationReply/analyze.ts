import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import {
  conversationPeopleFields,
  loadConversationReadingRules,
  toConversationParties,
} from "@/services/conversationTimeline"
import { CONVERSATION_STATES } from "@/constants/conversationState"
import { CLIENT_SIZES, MAX_KEY_OPPORTUNITIES, MAX_KEY_RISKS, RISK_LEVELS } from "@/constants/conversationReply"
import { toScore } from "@/constants/scoreBands"
import type { ConversationAnalysis, ScoreSignal } from "@/types/conversationReply"

// Zero temperature so the same conversation scores as consistently as possible from run to run
const ANALYSIS_TEMPERATURE = 0
// The analysis is a large structured output; give each provider more time than a short message
const ANALYSIS_TIMEOUT_MS = 90_000

const ScoreSignalSchema = z.object({
  score: z.number().describe("Integer from 0 to 100, following the score bands"),
  summary: z.string().describe("One short, evidence-based sentence explaining the score"),
})

/**
 * Evidence comes before the scores on purpose: the model commits to what was actually
 * said before it rates anything. Only the scores and conclusions reach the user.
 */
const AnalysisSchema = z.object({
  ...conversationPeopleFields,
  latest_meaningful_message: z.string().describe("Who sent the latest meaningful message and what it says, in one short line"),
  open_loops: z.array(z.string()).describe("Unanswered questions and open loops, each a few words"),
  positive_signals: z.array(z.string()).describe("Concrete positive signals from the conversation or profiles"),
  negative_signals: z.array(z.string()).describe("Concrete negative signals, objections or hesitation"),
  uncertain_signals: z.array(z.string()).describe("Things that are unclear or missing evidence"),
  client_potential: ScoreSignalSchema,
  relationship_strength: ScoreSignalSchema,
  long_term_potential: ScoreSignalSchema,
  client_size: z.object({ value: z.enum(CLIENT_SIZES), summary: z.string() }),
  buying_intent: ScoreSignalSchema,
  conversation_momentum: ScoreSignalSchema,
  recipient_interest: ScoreSignalSchema,
  decision_maker_likelihood: ScoreSignalSchema,
  opportunity_fit: ScoreSignalSchema,
  risk_level: z.object({ value: z.enum(RISK_LEVELS), summary: z.string() }),
  key_opportunities: z.array(z.string()).describe("2–4 short bullets, fewer only if fewer genuinely exist"),
  key_risks: z.array(z.string()).describe("1–3 short, actionable bullets"),
  recommended_next_move: z.string(),
  overall_assessment: z.string().describe("At most 3 short sentences"),
})

type AnalysisOutput = z.infer<typeof AnalysisSchema>

const SCORE_FIELDS = [
  "client_potential",
  "relationship_strength",
  "long_term_potential",
  "buying_intent",
  "conversation_momentum",
  "recipient_interest",
  "decision_maker_likelihood",
  "opportunity_fit",
] as const

export interface AnalysisResult {
  analysis: ConversationAnalysis
  // Compact reading handed to the reply writer as guidance
  brief: string
  // Whether the user wrote any message in the conversation
  userHasSpoken: boolean
}

interface AnalyzeOptions {
  dataBlocks: PromptDataBlock[]
  signal: AbortSignal
}

function findUnusableReason(output: AnalysisOutput): string | null {
  const badScore = SCORE_FIELDS.find((field) => !Number.isFinite(output[field].score))
  if (badScore) return `${badScore} score is not a number`
  if (!output.overall_assessment.trim()) return "missing overall assessment"
  if (!output.recommended_next_move.trim()) return "missing recommended next move"
  return null
}

function toScoreSignal({ score, summary }: { score: number; summary: string }): ScoreSignal {
  return { score: toScore(score), summary: summary.trim() }
}

function cleanList(items: string[], max: number): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, max)
}

function buildBrief(output: AnalysisOutput, analysis: ConversationAnalysis): string {
  const { parties } = analysis
  const timeline = output.timeline.map((entry, index) => `${index + 1}. ${entry.sender}: ${entry.gist}`).join("\n")
  const list = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none")
  return [
    `People: user = ${parties.userName ?? "not shown"}; other person = ${parties.otherPersonName ?? "unknown"}`,
    `Where it stands: ${CONVERSATION_STATES[parties.state]}`,
    `Timeline, oldest first:\n${timeline || "- none"}`,
    `Latest meaningful message: ${output.latest_meaningful_message.trim()}`,
    `Open loops:\n${list(cleanList(output.open_loops, 6))}`,
    `Positive signals:\n${list(cleanList(output.positive_signals, 6))}`,
    `Negative signals:\n${list(cleanList(output.negative_signals, 6))}`,
    `Objective recommended next move: ${analysis.recommendedNextMove}`,
  ].join("\n\n")
}

/**
 * Objective read of the conversation. It never sees the reply type or its prompt, so the
 * user's chosen strategy can't inflate the scores.
 */
export async function analyzeConversation({ dataBlocks, signal }: AnalyzeOptions): Promise<AnalysisResult> {
  const system = renderPrompt(loadPrompt("conversation-reply-analysis"), {
    CURRENT_DATE: new Date().toISOString().slice(0, 10),
    CONVERSATION_READING_RULES: loadConversationReadingRules(),
  })
  const user = composePromptMessage("Analyze this conversation.", dataBlocks)

  const { data, provider } = await generateStructuredWithFallback({
    schema: AnalysisSchema,
    name: "conversation_analysis",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: ANALYSIS_TEMPERATURE,
    timeoutMs: ANALYSIS_TIMEOUT_MS,
    signal,
    validate: findUnusableReason,
  })

  const analysis: ConversationAnalysis = {
    parties: toConversationParties(data),
    signals: {
      clientPotential: toScoreSignal(data.client_potential),
      relationshipStrength: toScoreSignal(data.relationship_strength),
      longTermPotential: toScoreSignal(data.long_term_potential),
      clientSize: { value: data.client_size.value, summary: data.client_size.summary.trim() },
      buyingIntent: toScoreSignal(data.buying_intent),
      conversationMomentum: toScoreSignal(data.conversation_momentum),
      recipientInterest: toScoreSignal(data.recipient_interest),
      decisionMakerLikelihood: toScoreSignal(data.decision_maker_likelihood),
      opportunityFit: toScoreSignal(data.opportunity_fit),
      riskLevel: { value: data.risk_level.value, summary: data.risk_level.summary.trim() },
    },
    keyOpportunities: cleanList(data.key_opportunities, MAX_KEY_OPPORTUNITIES),
    keyRisks: cleanList(data.key_risks, MAX_KEY_RISKS),
    recommendedNextMove: data.recommended_next_move.trim(),
    overallAssessment: data.overall_assessment.trim(),
  }

  console.info("Conversation analyzed:", JSON.stringify({ provider, state: analysis.parties.state }))
  return {
    analysis,
    brief: buildBrief(data, analysis),
    userHasSpoken: data.timeline.some((entry) => entry.sender === "user"),
  }
}
