import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import {
  BUDGET_SIGNALS,
  COMPANY_SIZES,
  DECISION_ROLES,
  LEAD_TEMPERATURES,
  NONE_SEEN,
  SENIORITY_LEVELS,
  TECHNICAL_LEVELS,
  UNKNOWN_VALUE,
  URGENCY_LEVELS,
} from "@/constants/leadSignals"
import { toScore } from "@/constants/scoreBands"
import type { LeadScore, LeadSignals } from "@/types/leadSignals"

// Zero temperature so the same conversation gets the same signals from run to run
const SIGNALS_TEMPERATURE = 0

const LeadScoreSchema = z.object({
  score: z.number().describe("Whole number from 0 to 100"),
  reason: z.string().describe("At most 12 words"),
})

const LeadSignalsSchema = z.object({
  meeting_chance: LeadScoreSchema,
  relationship_strength: LeadScoreSchema,
  client_potential: LeadScoreSchema,
  country: z.string().describe(`Country as stated in the profile or conversation, or ${UNKNOWN_VALUE}`),
  technical_level: z.enum(TECHNICAL_LEVELS),
  seniority: z.enum(SENIORITY_LEVELS),
  buying_intent: LeadScoreSchema,
  lead_temperature: z.enum(LEAD_TEMPERATURES),
  decision_role: z.enum(DECISION_ROLES),
  urgency: z.enum(URGENCY_LEVELS),
  budget_signal: z.enum(BUDGET_SIGNALS),
  company_size: z.enum(COMPANY_SIZES),
  industry: z.string().describe(`At most 4 words, or ${UNKNOWN_VALUE}`),
  main_need: z.string().describe(`The need or pain point they showed, at most 8 words, or ${NONE_SEEN}`),
  main_objection: z.string().describe(`Their main objection or hesitation, at most 8 words, or ${NONE_SEEN}`),
  next_step: z.string().describe("The best next step for the user, at most 12 words"),
})

type LeadSignalsOutput = z.infer<typeof LeadSignalsSchema>

function findUnusableReason(output: LeadSignalsOutput): string | null {
  const scores = [output.meeting_chance, output.relationship_strength, output.client_potential, output.buying_intent]
  if (!scores.every((entry) => Number.isFinite(entry.score))) return "a score is not a number"
  if (!output.next_step.trim()) return "missing next step"
  return null
}

function toLeadScore({ score, reason }: z.infer<typeof LeadScoreSchema>): LeadScore {
  return { score: toScore(score), reason: reason.trim() }
}

interface AssessOptions {
  // The tool's latest saved Lead Signals prompt
  signalsPrompt: string
  // Conversation, their profile and About Me
  dataBlocks: PromptDataBlock[]
  signal: AbortSignal
}

/**
 * Estimates the lead signals with a tool's latest saved Lead Signals prompt, under the
 * shared fixed rules. It never sees the tool's type or tone, so choosing one can't change
 * the signals.
 */
export async function assessLeadSignals({ signalsPrompt, dataBlocks, signal }: AssessOptions): Promise<LeadSignals> {
  const { data } = await generateStructuredWithFallback({
    schema: LeadSignalsSchema,
    name: "lead_signals",
    messages: [
      new SystemMessage(await loadPrompt("lead-signals-system")),
      new HumanMessage(composePromptMessage(signalsPrompt, dataBlocks)),
    ],
    temperature: SIGNALS_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  })

  return {
    meetingChance: toLeadScore(data.meeting_chance),
    relationshipStrength: toLeadScore(data.relationship_strength),
    clientPotential: toLeadScore(data.client_potential),
    country: data.country.trim() || UNKNOWN_VALUE,
    technicalLevel: data.technical_level,
    seniority: data.seniority,
    buyingIntent: toLeadScore(data.buying_intent),
    leadTemperature: data.lead_temperature,
    decisionRole: data.decision_role,
    urgency: data.urgency,
    budgetSignal: data.budget_signal,
    companySize: data.company_size,
    industry: data.industry.trim() || UNKNOWN_VALUE,
    mainNeed: data.main_need.trim() || NONE_SEEN,
    mainObjection: data.main_objection.trim() || NONE_SEEN,
    nextStep: data.next_step.trim(),
  }
}

/**
 * The lead signals are extra: when they can't be produced, the tool's main output is still
 * returned. Never rejects, because it runs alongside the main generation and may outlive a
 * failed one.
 */
export async function assessLeadSignalsSafely(options: AssessOptions): Promise<LeadSignals | null> {
  try {
    return await assessLeadSignals(options)
  } catch (error: unknown) {
    if (!options.signal.aborted) {
      console.warn("⚠️ Lead signals failed; returning the result without them:", error instanceof Error ? error.message : error)
    }
    return null
  }
}
