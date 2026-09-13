import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { humanizeTexts } from "@/services/humanizer"
import { assessLeadSignalsSafely } from "@/services/leadSignals"
import {
  conversationPeopleFields,
  loadConversationReadingRules,
  toConversationParties,
} from "@/services/conversationTimeline"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { LINKEDIN_MESSAGE_MAX_CHARS } from "@/constants/linkedinLimits"
import { getFollowUpTypeLabel, type FollowUpTypeId } from "@/constants/followUp"
import type { GeneratedFollowUp } from "@/types/followUp"
import { getGenerationInputs } from "./prompts"

// Slightly creative so follow-ups read like a person wrote them
const WRITING_TEMPERATURE = 0.7

/**
 * The model lists every message with its sender and summarizes the thread before writing,
 * so the follow-up is grounded in what was actually said. These fields steer the writing
 * and are logged; only the message is shown.
 */
const FollowUpSchema = z.object({
  ...conversationPeopleFields,
  conversation_summary: z
    .string()
    .describe("1–2 sentences: what was discussed, who said what last and what is still open"),
  follow_up_angle: z
    .string()
    .describe("The specific thread or profile detail this follow-up builds on, decided before writing the message"),
  message: z.string().describe("The complete follow-up message text, nothing else"),
})

type FollowUpOutput = z.infer<typeof FollowUpSchema>

interface GenerateOptions {
  conversation: string
  profileData: string | null
  type: FollowUpTypeId
  signal: AbortSignal
}

function findUnusableReason(output: FollowUpOutput): string | null {
  const message = cleanGeneratedText(output.message)
  if (!message) return "empty message"
  if (containsPlaceholder(message)) return "message contains a placeholder"
  if (!output.conversation_summary.trim()) return "missing conversation summary"
  return null
}

/**
 * Generates one follow-up with the latest saved prompt for the selected type, then
 * rewrites it with the Humanization prompt. In parallel, the saved Lead Signals prompt
 * estimates the lead, independently of the type. The pasted conversation and profile are
 * untrusted data inside their own delimiter tags; {{follow_up_type}} inserts the type name.
 */
export async function generateFollowUp({
  conversation,
  profileData,
  type,
  signal,
}: GenerateOptions): Promise<GeneratedFollowUp> {
  const { typePrompt, signalsPrompt, senderProfile } = await getGenerationInputs(type)
  const conversationBlocks: PromptDataBlock[] = [
    { variable: "conversation", tag: "conversation_history", label: "Previous conversation", content: conversation },
    { variable: "profile_data", tag: "profile_data", label: "Profile information about them", content: profileData },
  ]
  const signalsPromise = assessLeadSignalsSafely({
    signalsPrompt,
    dataBlocks: [
      ...conversationBlocks,
      { variable: "sender_profile", tag: "sender_profile", label: "About me", content: senderProfile },
    ],
    signal,
  })

  const system = renderPrompt(loadPrompt("follow-up-system"), {
    CURRENT_DATE: new Date().toISOString().slice(0, 10),
    CONVERSATION_READING_RULES: loadConversationReadingRules(),
  })
  const user = composePromptMessage(typePrompt, conversationBlocks, { follow_up_type: getFollowUpTypeLabel(type) })

  const { data, provider } = await generateStructuredWithFallback({
    schema: FollowUpSchema,
    name: "follow_up_message",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  })

  const humanization = await humanizeTexts({
    fields: [
      {
        id: "message",
        kind: "LinkedIn follow-up message in an existing conversation",
        text: cleanGeneratedText(data.message),
        maxChars: LINKEDIN_MESSAGE_MAX_CHARS,
      },
    ],
    signal,
  })
  const message = humanization.texts.message
  const parties = toConversationParties(data)
  const signals = await signalsPromise
  console.info(
    "Follow-up generated:",
    JSON.stringify({
      type,
      provider,
      state: parties.state,
      usedProfile: profileData !== null,
      humanized: humanization.humanized,
      leadSignals: signals !== null,
      characters: message.length,
    })
  )

  return {
    message,
    type,
    characterCount: message.length,
    usedProfile: profileData !== null,
    signals,
  }
}
