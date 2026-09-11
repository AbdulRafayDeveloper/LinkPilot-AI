import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { containsSenderClaim } from "@/services/senderGuard"
import { findUnsupportedUserClaims } from "./claims"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { LINKEDIN_MESSAGE_MAX_CHARS } from "@/constants/linkedinLimits"
import { getReplyTypeLabel, type ConversationReplyTypeId } from "@/constants/conversationReply"

// Slightly creative so replies read like a person wrote them
const WRITING_TEMPERATURE = 0.7

// Durations and prices: the specifics models most often invent when asked "how long" or "how much"
const SPECIFIC_COMMITMENT =
  /\b\d+(?:\s*(?:-|–|to)\s*\d+)?\+?\s*(?:business\s+)?(?:hours?|days?|weeks?|months?)\b|\b(?:a few|a couple of|several)\s+(?:days|weeks|months)\b|[$€£]\s?\d[\d,.]*\s*[kK]?|\b\d[\d,.]*\s*(?:usd|dollars|euros|pounds)\b/gi

// "While I can't speak to…": models undercut the user when they know nothing about them
const UNDERMINING_PHRASE =
  /\b(?:while\s+)?I\s+(?:can't|cannot|can not|am not able to|don't|do not)\s+(?:really\s+)?(?:speak|comment|confirm|claim|say|vouch)\b[^.!?]*/i

/**
 * The questions come before the reply on purpose: the model records what the sources
 * actually say before it writes, so it can't answer "how long?" or "how much?" from thin air.
 */
const ReplySchema = z.object({
  questions_to_answer: z
    .array(
      z.object({
        question: z.string().describe("A question or request from the other person the reply needs to address"),
        known_answer: z
          .string()
          .nullable()
          .describe("The answer exactly as stated in the sender profile or the user's own earlier messages, or null if they don't state it"),
      })
    )
    .describe("Open questions from the other person, empty if there are none"),
  strategy_note: z
    .string()
    .describe("One short sentence for the user on how the reply applies the reply type, or why it holds back"),
  reply: z.string().describe("The complete reply text, nothing else"),
})

type ReplyOutput = z.infer<typeof ReplySchema>

interface WriteReplyOptions {
  typePrompt: string
  replyType: ConversationReplyTypeId
  dataBlocks: PromptDataBlock[]
  analysisBrief: string
  // True when nothing is known about the user: no About Me and no message of their own
  guardSenderClaims: boolean
  signal: AbortSignal
}

interface ReplyProblems {
  // Durations or prices the reply states that no source supports
  unsupportedSpecifics: string[]
  // Sentences describing the user's own work in terms no source contains
  unsupportedClaims: string[]
  // A first-person claim about the user's work when nothing is known about them
  unsupportedSenderClaim: boolean
  // A phrase that undercuts the user, e.g. "I can't speak to that myself"
  underminingPhrase: string | null
}

export interface WrittenReply extends ReplyProblems {
  reply: string
  strategyNote: string
  provider: ModelProvider
}

function findUnusableReason(output: ReplyOutput): string | null {
  const reply = cleanGeneratedText(output.reply)
  if (!reply) return "empty reply"
  if (containsPlaceholder(reply)) return "reply contains a placeholder"
  if (!output.strategy_note.trim()) return "missing strategy note"
  return null
}

function findUnsupportedSpecifics(reply: string, sourceText: string): string[] {
  const sources = sourceText.toLowerCase()
  const matches = [...reply.matchAll(SPECIFIC_COMMITMENT)].map((match) => match[0].trim())
  return [...new Set(matches.filter((match) => !sources.includes(match.toLowerCase())))]
}

function describeProblems({
  unsupportedSpecifics,
  unsupportedClaims,
  unsupportedSenderClaim,
  underminingPhrase,
}: ReplyProblems): string[] {
  return [
    unsupportedSpecifics.length > 0 &&
      `It states specifics that neither the conversation nor my About Me contains: ${unsupportedSpecifics.join(", ")}. Don't invent durations, prices or other commitments; where they asked for one, acknowledge the question and offer a real way forward instead.`,
    unsupportedClaims.length > 0 &&
      `It says things about me that neither my About Me nor my own messages support: ${unsupportedClaims.map((claim) => `"${claim}"`).join("; ")}. Remove them. If they asked about my work, acknowledge the question warmly without describing specifics, and keep the focus on them.`,
    unsupportedSenderClaim &&
      "It says things about me (my work, services, experience or background), but neither my About Me nor my own messages state any of that. Make no claim about me; keep the focus on them and their request.",
    underminingPhrase &&
      `It undercuts me ("${underminingPhrase.trim()}"). Don't say what I can't speak to or do; simply make no claim about me and keep the reply confident and useful.`,
  ].filter((problem): problem is string => typeof problem === "string")
}

/**
 * Writes the reply with the latest saved prompt for the reply type. The objective
 * analysis is passed in as guidance through {{conversation_analysis}}; {{reply_type}}
 * inserts the type name. A reply with unsupported durations or prices, or with claims
 * about the user that no quoted source supports, gets one controlled rewrite.
 */
export async function writeReply({
  typePrompt,
  replyType,
  dataBlocks,
  analysisBrief,
  guardSenderClaims,
  signal,
}: WriteReplyOptions): Promise<WrittenReply> {
  const system = renderPrompt(loadPrompt("conversation-reply-system"), { MAX_CHARS: LINKEDIN_MESSAGE_MAX_CHARS })
  const user = composePromptMessage(
    typePrompt,
    [
      ...dataBlocks,
      {
        variable: "conversation_analysis",
        tag: "conversation_analysis",
        label: "Conversation analysis",
        content: analysisBrief,
      },
    ],
    { reply_type: getReplyTypeLabel(replyType) }
  )
  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const generation = {
    schema: ReplySchema,
    name: "conversation_reply",
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  }
  const sourceText = dataBlocks.map((block) => block.content ?? "").join("\n")
  const findProblems = (text: string): ReplyProblems => ({
    unsupportedSpecifics: findUnsupportedSpecifics(text, sourceText),
    unsupportedClaims: findUnsupportedUserClaims(text, sourceText),
    unsupportedSenderClaim: guardSenderClaims && containsSenderClaim(text),
    underminingPhrase: text.match(UNDERMINING_PHRASE)?.[0] ?? null,
  })

  const first = await generateStructuredWithFallback({ ...generation, messages })
  let { data, provider } = first
  let reply = cleanGeneratedText(data.reply)
  let problems = findProblems(reply)
  const problemDescriptions = describeProblems(problems)

  if (problemDescriptions.length > 0) {
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(
          `Rewrite your draft below. ${problemDescriptions.join(" ")} Keep everything else.\n\n<draft_reply>\n${reply}\n</draft_reply>`
        ),
      ],
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Conversation reply rewrite failed; returning the draft with a warning:", error)
      return null
    })
    if (rewrite) {
      data = rewrite.data
      provider = rewrite.provider
      reply = cleanGeneratedText(rewrite.data.reply)
      problems = findProblems(reply)
    }
  }

  return { reply, strategyNote: data.strategy_note.trim(), provider, ...problems }
}
