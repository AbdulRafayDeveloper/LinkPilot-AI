import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { humanizeTexts } from "@/services/humanizer"
import { assessLeadSignalsSafely } from "@/services/leadSignals"
import { findInventedProof, findUnsupportedUserClaims } from "@/services/userClaims"
import {
  conversationPeopleFields,
  loadConversationReadingRules,
  toConversationParties,
} from "@/services/conversationTimeline"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { findUnsupportedFigures } from "@/lib/figures"
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

interface MessageProblems {
  // Figures (results, percentages, durations, counts) that neither the conversation nor the profile contains
  figures: string[]
  // Sentences describing the user's own work in terms the conversation doesn't contain
  claims: string[]
  // Case studies, unnamed similar companies or worded results ("in half") the conversation doesn't mention
  proof: string[]
}

function findUnusableReason(output: FollowUpOutput): string | null {
  const message = cleanGeneratedText(output.message)
  if (!message) return "empty message"
  if (containsPlaceholder(message)) return "message contains a placeholder"
  if (!output.conversation_summary.trim()) return "missing conversation summary"
  return null
}

function describeProblems({ figures, claims, proof }: MessageProblems): string[] {
  return [
    figures.length > 0 &&
      `It states figures that neither the conversation nor the profile contains: ${figures.join(", ")}. These are invented results. Remove them and make the point without numbers.`,
    claims.length > 0 &&
      `It says things about me that my own messages don't support: ${claims.map((claim) => `"${claim}"`).join("; ")}. Remove them and keep the focus on them.`,
    proof.length > 0 &&
      `It backs the message with results or examples nobody mentioned (${proof.map((item) => `"${item}"`).join(", ")}). Don't invent case studies, other companies' results or outcomes. Offer something real instead, such as a question about how they handle it today or an offer to walk them through the idea.`,
  ].filter((problem): problem is string => typeof problem === "string")
}

// True when the humanized text has a problem the verified draft didn't have
function addsProblems(draft: MessageProblems, rewrite: MessageProblems): boolean {
  return (
    rewrite.figures.some((figure) => !draft.figures.includes(figure)) ||
    rewrite.claims.length > draft.claims.length ||
    rewrite.proof.some((item) => !draft.proof.includes(item))
  )
}

/**
 * Generates one follow-up with the latest saved prompt for the selected type. A message
 * with invented figures or unsupported claims about the user gets one controlled rewrite,
 * then it's rewritten with the Humanization prompt, which may not add either. In parallel,
 * the saved Lead Signals prompt estimates the lead, independently of the type. The pasted
 * conversation and profile are untrusted data inside their own delimiter tags;
 * {{follow_up_type}} inserts the type name.
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

  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const generation = {
    schema: FollowUpSchema,
    name: "follow_up_message",
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  }
  const sourceText = [conversation, profileData ?? ""].join("\n")
  const findProblems = (text: string): MessageProblems => ({
    figures: findUnsupportedFigures(text, sourceText),
    claims: findUnsupportedUserClaims(text, sourceText),
    proof: findInventedProof(text, sourceText),
  })

  let { data, provider } = await generateStructuredWithFallback({ ...generation, messages })
  let draft = cleanGeneratedText(data.message)
  let problems = findProblems(draft)
  const problemDescriptions = describeProblems(problems)
  const rewritten = problemDescriptions.length > 0
  if (rewritten) {
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(
          `Rewrite your draft below. ${problemDescriptions.join(" ")} Keep everything else.\n\n<draft_message>\n${draft}\n</draft_message>`
        ),
      ],
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Follow-up rewrite failed; keeping the draft:", error)
      return null
    })
    if (rewrite) {
      data = rewrite.data
      provider = rewrite.provider
      draft = cleanGeneratedText(data.message)
      problems = findProblems(draft)
    }
  }

  const draftProblems = problems
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "message",
        kind: "LinkedIn follow-up message in an existing conversation",
        text: draft,
        maxChars: LINKEDIN_MESSAGE_MAX_CHARS,
      },
    ],
    signal,
    validate: (_id, text) =>
      addsProblems(draftProblems, findProblems(text)) ? "adds invented figures or claims about the user" : null,
  })
  const message = humanization.texts.message
  const finalProblems = findProblems(message)
  const parties = toConversationParties(data)
  const signals = await signalsPromise
  console.info(
    "Follow-up generated:",
    JSON.stringify({
      type,
      provider,
      state: parties.state,
      usedProfile: profileData !== null,
      rewritten,
      unsupportedFigures: finalProblems.figures,
      unsupportedClaims: finalProblems.claims.length,
      inventedProof: finalProblems.proof,
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
