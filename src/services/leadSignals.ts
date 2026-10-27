import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
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

const leadScoreSchema = (book: PromptBook) =>
  z.object({
    score: z.number().describe(book.text("lead-signals.field.score")),
    reason: z.string().describe(book.text("lead-signals.field.reason")),
  })

// What each field means is part of the shared instructions prompt, so the schema is built from it
const leadSignalsSchema = (book: PromptBook) =>
  z.object({
  meeting_chance: leadScoreSchema(book),
  relationship_strength: leadScoreSchema(book),
  client_potential: leadScoreSchema(book),
  country: z.string().describe(book.text("lead-signals.field.country", { unknown: UNKNOWN_VALUE })),
  technical_level: z.enum(TECHNICAL_LEVELS),
  seniority: z.enum(SENIORITY_LEVELS),
  buying_intent: leadScoreSchema(book),
  lead_temperature: z.enum(LEAD_TEMPERATURES),
  decision_role: z.enum(DECISION_ROLES),
  urgency: z.enum(URGENCY_LEVELS),
  budget_signal: z.enum(BUDGET_SIGNALS),
  company_size: z.enum(COMPANY_SIZES),
  industry: z.string().describe(book.text("lead-signals.field.industry", { unknown: UNKNOWN_VALUE })),
  main_need: z.string().describe(book.text("lead-signals.field.main-need", { none: NONE_SEEN })),
  main_objection: z.string().describe(book.text("lead-signals.field.main-objection", { none: NONE_SEEN })),
  next_step: z.string().describe(book.text("lead-signals.field.next-step")),
})

type LeadSignalsOutput = z.infer<ReturnType<typeof leadSignalsSchema>>

function findUnusableReason(output: LeadSignalsOutput): string | null {
  const scores = [output.meeting_chance, output.relationship_strength, output.client_potential, output.buying_intent]
  if (!scores.every((entry) => Number.isFinite(entry.score))) return "a score is not a number"
  if (!output.next_step.trim()) return "missing next step"
  return null
}

function toLeadScore({ score, reason }: z.infer<ReturnType<typeof leadScoreSchema>>): LeadScore {
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
  const book = await loadPromptBook("shared-instructions")
  const { data } = await generateStructuredWithFallback({
    schema: leadSignalsSchema(book),
    name: "lead_signals",
    messages: [
      new SystemMessage(await loadPrompt("lead-signals-system")),
      new HumanMessage(await composePromptMessage(signalsPrompt, dataBlocks)),
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
