import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import type { PromptBook } from "@/services/promptBook"
import { containsSenderClaim } from "@/services/senderGuard"
import { humanizeTexts } from "@/services/humanizer"
import { findUnsupportedUserClaims } from "@/services/userClaims"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { findUnsupportedFigures } from "@/lib/figures"
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
const replySchema = (book: PromptBook) =>
  z.object({
    questions_to_answer: z
      .array(
        z.object({
          question: z.string().describe(book.text("reply.field.question")),
          known_answer: z.string().nullable().describe(book.text("reply.field.known-answer")),
        })
      )
      .describe(book.text("reply.field.questions")),
    strategy_note: z.string().describe(book.text("reply.field.strategy-note")),
    reply: z.string().describe(book.text("reply.field.reply")),
  })

type ReplyOutput = z.infer<ReturnType<typeof replySchema>>

interface WriteReplyOptions {
  typePrompt: string
  replyType: ConversationReplyTypeId
  dataBlocks: PromptDataBlock[]
  analysisBrief: string
  // True when nothing is known about the user: no About Me and no message of their own
  guardSenderClaims: boolean
  signal: AbortSignal
  // The tool's instructions prompt, loaded once for the whole request
  book: PromptBook
}

interface ReplyProblems {
  // Durations, prices, percentages or other figures the reply states that no source supports
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
  humanized: boolean
}

function findUnusableReason(output: ReplyOutput): string | null {
  const reply = cleanGeneratedText(output.reply)
  if (!reply) return "empty reply"
  if (containsPlaceholder(reply)) return "reply contains a placeholder"
  if (!output.strategy_note.trim()) return "missing strategy note"
  return null
}

// Unsupported durations and prices, plus invented results such as "40% faster"
function findUnsupportedSpecifics(reply: string, sourceText: string): string[] {
  const sources = sourceText.toLowerCase()
  const matches = [...reply.matchAll(SPECIFIC_COMMITMENT)].map((match) => match[0].trim())
  const commitments = matches.filter((match) => !sources.includes(match.toLowerCase()))
  return [...new Set([...commitments, ...findUnsupportedFigures(reply, sourceText)])]
}

// True when the rewrite has a problem the draft didn't have
function addsProblems(draft: ReplyProblems, rewrite: ReplyProblems): boolean {
  return (
    rewrite.unsupportedSpecifics.some((specific) => !draft.unsupportedSpecifics.includes(specific)) ||
    rewrite.unsupportedClaims.length > draft.unsupportedClaims.length ||
    (rewrite.unsupportedSenderClaim && !draft.unsupportedSenderClaim) ||
    (rewrite.underminingPhrase !== null && draft.underminingPhrase === null)
  )
}

// What is wrong with a draft, in the words of the tool's instructions prompt
function describeProblems(
  { unsupportedSpecifics, unsupportedClaims, unsupportedSenderClaim, underminingPhrase }: ReplyProblems,
  book: PromptBook
): string[] {
  return [
    unsupportedSpecifics.length > 0 && book.text("problem.unsupported-specifics", { specifics: unsupportedSpecifics.join(", ") }),
    unsupportedClaims.length > 0 &&
      book.text("problem.unsupported-claims", { claims: unsupportedClaims.map((claim) => `"${claim}"`).join("; ") }),
    unsupportedSenderClaim && book.text("problem.sender-claim"),
    underminingPhrase && book.text("problem.undermining", { phrase: underminingPhrase.trim() }),
  ].filter((problem): problem is string => typeof problem === "string")
}

/**
 * Writes the reply with the latest saved prompt for the reply type. The objective
 * analysis is passed in as guidance through {{conversation_analysis}}; {{reply_type}}
 * inserts the type name. A reply with unsupported durations or prices, or with claims
 * about the user that no quoted source supports, gets one controlled rewrite. The final
 * reply is rewritten with the Humanization prompt, which may not add any such problem.
 */
export async function writeReply({
  typePrompt,
  replyType,
  dataBlocks,
  analysisBrief,
  guardSenderClaims,
  signal,
  book,
}: WriteReplyOptions): Promise<WrittenReply> {
  const system = renderPrompt(await loadPrompt("conversation-reply-system"), { MAX_CHARS: LINKEDIN_MESSAGE_MAX_CHARS })
  const user = await composePromptMessage(
    typePrompt,
    [
      ...dataBlocks,
      {
        variable: "conversation_analysis",
        tag: "conversation_analysis",
        label: book.text("label.analysis"),
        content: analysisBrief,
      },
    ],
    { reply_type: getReplyTypeLabel(replyType) }
  )
  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const generation = {
    schema: replySchema(book),
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
  const problemDescriptions = describeProblems(problems, book)

  if (problemDescriptions.length > 0) {
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(book.text("rewrite", { problems: problemDescriptions.join(" "), draft: reply })),
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

  const draftProblems = problems
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "reply",
        kind: book.text("humanize.kind"),
        text: reply,
        maxChars: LINKEDIN_MESSAGE_MAX_CHARS,
      },
    ],
    signal,
    validate: (_id, text) =>
      addsProblems(draftProblems, findProblems(text)) ? book.text("humanize.problem.adds-problems") : null,
  })
  reply = humanization.texts.reply
  problems = findProblems(reply)

  return { reply, strategyNote: data.strategy_note.trim(), provider, humanized: humanization.humanized, ...problems }
}
