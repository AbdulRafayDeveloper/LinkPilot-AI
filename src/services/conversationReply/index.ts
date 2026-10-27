import type { PromptDataBlock } from "@/services/promptComposer"
import { findRelevantExperience } from "@/services/senderContext"
import { loadPromptBook } from "@/services/promptBook"
import { assessLeadSignalsSafely } from "@/services/leadSignals"
import { LINKEDIN_MESSAGE_MAX_CHARS } from "@/constants/linkedinLimits"
import type { ConversationReplyTypeId } from "@/constants/conversationReply"
import type { ConversationReplyResult } from "@/types/conversationReply"
import { getGenerationPrompts } from "./prompts"
import { analyzeConversation } from "./analyze"
import { writeReply } from "./reply"

interface AnalyzeAndReplyOptions {
  conversation: string
  profileData: string | null
  replyType: ConversationReplyTypeId
  signal: AbortSignal
}

/**
 * Two steps. First an objective analysis that never sees the reply tone or its prompt,
 * so the signals can't be steered by the chosen strategy. Then the reply, written with
 * the latest saved prompt for the tone and the analysis as guidance. Alongside the
 * analysis, this tool's saved Lead Signals prompt estimates the lead, also without the tone.
 */
export async function analyzeAndReply({
  conversation,
  profileData,
  replyType,
  signal,
}: AnalyzeAndReplyOptions): Promise<ConversationReplyResult> {
  // Every word besides the analysis, system, type and lead-signals prompts is read from the instructions prompts
  const [{ typePrompt, signalsPrompt }, experience, book, shared] = await Promise.all([
    getGenerationPrompts(replyType),
    findRelevantExperience(),
    loadPromptBook("conversation-reply-instructions"),
    loadPromptBook("shared-instructions"),
  ])

  const dataBlocks: PromptDataBlock[] = [
    { variable: "conversation", tag: "conversation_history", label: book.text("label.conversation"), content: conversation, pasted: true },
    { variable: "profile_data", tag: "profile_data", label: book.text("label.their-profile"), content: profileData, pasted: true },
    {
      variable: "sender_profile",
      tag: "sender_profile",
      label: book.text("label.about-me"),
      content: experience.text,
      emptyText: book.text("empty.sender-profile"),
    },
  ]

  const leadSignalsPromise = assessLeadSignalsSafely({ tool: "conversation-reply", signalsPrompt, dataBlocks, signal })
  const { analysis, brief, userHasSpoken } = await analyzeConversation({ dataBlocks, signal, book, shared })
  const { reply, strategyNote, provider, humanized, unsupportedSpecifics, unsupportedClaims, unsupportedSenderClaim } = await writeReply({
    typePrompt,
    replyType,
    dataBlocks,
    analysisBrief: brief,
    // With no About Me and no message of their own, any claim about the user's work is invented
    guardSenderClaims: !experience.hasProfile && !userHasSpoken,
    signal,
    book,
  })

  const leadSignals = await leadSignalsPromise
  const warnings = [
    unsupportedSpecifics.length > 0 &&
      `This reply mentions ${unsupportedSpecifics.join(", ")}, which isn't in the conversation or your About Me. Check it before sending.`,
    (unsupportedSenderClaim || unsupportedClaims.length > 0) &&
      "This reply may describe your work in ways your About Me and your own messages don't support. Check what it says about you before sending.",
    reply.length > LINKEDIN_MESSAGE_MAX_CHARS &&
      `This reply is ${reply.length.toLocaleString()} characters, over LinkedIn's ${LINKEDIN_MESSAGE_MAX_CHARS.toLocaleString()}-character limit. Shorten it before sending.`,
  ].filter((warning): warning is string => typeof warning === "string")

  console.info(
    "Conversation reply generated:",
    JSON.stringify({
      replyType,
      replyProvider: provider,
      humanized,
      state: analysis.parties.state,
      usedProfile: profileData !== null,
      usedSenderProfile: experience.hasProfile,
      unsupportedSpecifics,
      unsupportedClaims,
      unsupportedSenderClaim,
      leadSignals: leadSignals !== null,
      characters: reply.length,
    })
  )

  return {
    reply,
    replyType,
    strategyNote,
    characterCount: reply.length,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
    usedProfile: profileData !== null,
    usedSenderProfile: experience.hasProfile,
    analysis,
    leadSignals,
  }
}
