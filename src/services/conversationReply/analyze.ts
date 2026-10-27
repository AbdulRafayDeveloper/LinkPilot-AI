import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import type { PromptBook } from "@/services/promptBook"
import {
  conversationPeopleFields,
  loadConversationReadingRules,
  toConversationParties,
} from "@/services/conversationTimeline"
import { CLIENT_SIZES, MAX_KEY_OPPORTUNITIES, MAX_KEY_RISKS, RISK_LEVELS } from "@/constants/conversationReply"
import { toScore } from "@/constants/scoreBands"
import type { ConversationAnalysis, ScoreSignal } from "@/types/conversationReply"

// Zero temperature so the same conversation scores as consistently as possible from run to run
const ANALYSIS_TEMPERATURE = 0
// The analysis is a large structured output; give each provider more time than a short message
const ANALYSIS_TIMEOUT_MS = 90_000

const scoreSignalSchema = (book: PromptBook) =>
  z.object({
    score: z.number().describe(book.text("analysis.field.score")),
    summary: z.string().describe(book.text("analysis.field.score-summary")),
  })

/**
 * Evidence comes before the scores on purpose: the model commits to what was actually
 * said before it rates anything. Only the scores and conclusions reach the user. What each field
 * means is read from the instructions prompts, so the schema is built from them.
 */
const analysisSchema = (book: PromptBook, shared: PromptBook) => {
  const scoreSignal = scoreSignalSchema(book)
  return z.object({
    ...conversationPeopleFields(shared),
    latest_meaningful_message: z.string().describe(book.text("analysis.field.latest-meaningful-message")),
    open_loops: z.array(z.string()).describe(book.text("analysis.field.open-loops")),
    positive_signals: z.array(z.string()).describe(book.text("analysis.field.positive-signals")),
    negative_signals: z.array(z.string()).describe(book.text("analysis.field.negative-signals")),
    uncertain_signals: z.array(z.string()).describe(book.text("analysis.field.uncertain-signals")),
    client_potential: scoreSignal,
    relationship_strength: scoreSignal,
    long_term_potential: scoreSignal,
    client_size: z.object({ value: z.enum(CLIENT_SIZES), summary: z.string() }),
    buying_intent: scoreSignal,
    conversation_momentum: scoreSignal,
    recipient_interest: scoreSignal,
    decision_maker_likelihood: scoreSignal,
    opportunity_fit: scoreSignal,
    risk_level: z.object({ value: z.enum(RISK_LEVELS), summary: z.string() }),
    key_opportunities: z.array(z.string()).describe(book.text("analysis.field.key-opportunities")),
    key_risks: z.array(z.string()).describe(book.text("analysis.field.key-risks")),
    recommended_next_move: z.string(),
    overall_assessment: z.string().describe(book.text("analysis.field.overall-assessment")),
  })
}

type AnalysisOutput = z.infer<ReturnType<typeof analysisSchema>>

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
  // The tool's instructions prompt and the shared one, loaded once for the whole request
  book: PromptBook
  shared: PromptBook
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

// The reading handed to the reply writer, in the words of the tool's instructions prompt
function buildBrief(output: AnalysisOutput, analysis: ConversationAnalysis, book: PromptBook): string {
  const { parties } = analysis
  const none = book.text("brief.none")
  const timeline = output.timeline.map((entry, index) => `${index + 1}. ${entry.sender}: ${entry.gist}`).join("\n")
  const list = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : none)
  return [
    book.text("brief.people", {
      user: parties.userName ?? book.text("brief.user-unknown"),
      other: parties.otherPersonName ?? book.text("brief.other-unknown"),
    }),
    book.text("brief.where-it-stands", { state: book.text(`state.${parties.state}`) }),
    book.text("brief.timeline", { timeline: timeline || none }),
    book.text("brief.latest", { message: output.latest_meaningful_message.trim() }),
    book.text("brief.open-loops", { items: list(cleanList(output.open_loops, 6)) }),
    book.text("brief.positive-signals", { items: list(cleanList(output.positive_signals, 6)) }),
    book.text("brief.negative-signals", { items: list(cleanList(output.negative_signals, 6)) }),
    book.text("brief.next-move", { move: analysis.recommendedNextMove }),
  ].join("\n\n")
}

/**
 * Objective read of the conversation. It never sees the reply type or its prompt, so the
 * user's chosen strategy can't inflate the scores.
 */
export async function analyzeConversation({ dataBlocks, signal, book, shared }: AnalyzeOptions): Promise<AnalysisResult> {
  const system = renderPrompt(await loadPrompt("conversation-reply-analysis"), {
    CURRENT_DATE: new Date().toISOString().slice(0, 10),
    CONVERSATION_READING_RULES: await loadConversationReadingRules(),
  })
  const user = await composePromptMessage(book.text("analysis.request"), dataBlocks)

  const { data, provider } = await generateStructuredWithFallback({
    schema: analysisSchema(book, shared),
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
    brief: buildBrief(data, analysis, book),
    userHasSpoken: data.timeline.some((entry) => entry.sender === "user"),
  }
}
