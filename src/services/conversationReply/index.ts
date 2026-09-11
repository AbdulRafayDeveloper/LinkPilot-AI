import type { PromptDataBlock } from "@/services/promptComposer"
import { findRelevantExperience } from "@/services/senderContext"
import { LINKEDIN_MESSAGE_MAX_CHARS } from "@/constants/linkedinLimits"
import type { ConversationReplyTypeId } from "@/constants/conversationReply"
import type { ConversationReplyResult } from "@/types/conversationReply"
import { getActiveReplyTypePrompt } from "./prompts"
import { analyzeConversation } from "./analyze"
import { writeReply } from "./reply"

// Placed where {{sender_profile}} goes when the user hasn't filled in About Me
const NO_SENDER_PROFILE_TEXT =
  "Not provided. You know nothing about the sender's work, services, experience or results beyond what the sender said in the conversation. Don't describe or assume any of it."

interface AnalyzeAndReplyOptions {
  conversation: string
  profileData: string | null
  replyType: ConversationReplyTypeId
  signal: AbortSignal
}

/**
 * Two steps. First an objective analysis that never sees the reply type or its prompt,
 * so the signals can't be steered by the chosen strategy. Then the reply, written with
 * the latest saved prompt for the reply type and the analysis as guidance.
 */
export async function analyzeAndReply({
  conversation,
  profileData,
  replyType,
  signal,
}: AnalyzeAndReplyOptions): Promise<ConversationReplyResult> {
  const [typePrompt, experience] = await Promise.all([
    getActiveReplyTypePrompt(replyType),
    findRelevantExperience(),
  ])

  const dataBlocks: PromptDataBlock[] = [
    { variable: "conversation", tag: "conversation_history", label: "Previous conversation", content: conversation },
    { variable: "profile_data", tag: "profile_data", label: "Their profile", content: profileData },
    {
      variable: "sender_profile",
      tag: "sender_profile",
      label: "About me",
      content: experience.text,
      emptyText: NO_SENDER_PROFILE_TEXT,
    },
  ]

  const { analysis, brief, userHasSpoken } = await analyzeConversation({ dataBlocks, signal })
  const { reply, strategyNote, provider, unsupportedSpecifics, unsupportedClaims, unsupportedSenderClaim } = await writeReply({
    typePrompt,
    replyType,
    dataBlocks,
    analysisBrief: brief,
    // With no About Me and no message of their own, any claim about the user's work is invented
    guardSenderClaims: !experience.hasProfile && !userHasSpoken,
    signal,
  })

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
      state: analysis.parties.state,
      usedProfile: profileData !== null,
      usedSenderProfile: experience.hasProfile,
      unsupportedSpecifics,
      unsupportedClaims,
      unsupportedSenderClaim,
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
  }
}
