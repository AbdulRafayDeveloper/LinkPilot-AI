import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { humanizeTexts } from "@/services/humanizer"
import { asUserFacingError } from "@/lib/errors"
import { cleanGeneratedText, findPlaceholders, stripMarkdownMarks } from "@/lib/generatedText"
import { MESSAGE_REWRITER_MESSAGES, rewrittenMaxChars } from "@/constants/messageRewriter"
import type { MessageSource, RewrittenMessage } from "@/types/messageRewriter"
import { getMessageRewriterPrompt } from "./prompts"

// Saying the same thing in fewer words leaves little room for invention
const REWRITE_TEMPERATURE = 0.3
// Anything shorter than this is not a message
const MIN_MESSAGE_LENGTH = 2
// The humanizer may reword, not lengthen: a little room covers a sentence it had to split
const HUMANIZE_TOLERANCE = 1.1

const RewrittenMessageSchema = z.object({
  source_language: z
    .string()
    .describe("The language the original message is written in, named in English, for example Urdu, Spanish or English"),
  message: z.string().describe("The rewritten message in clear, simple English, ready to send, and nothing else"),
})

type RewrittenMessageOutput = z.infer<typeof RewrittenMessageSchema>

interface RewriteOptions {
  message: string
  source: MessageSource
  signal: AbortSignal
}

const clean = (raw: string) => stripMarkdownMarks(cleanGeneratedText(raw))

/**
 * A draft is thrown away only when it cannot be used at all. A slot the model invented, which
 * appears nowhere in the original, means it was guessing at something the user never said.
 */
function findUnusableReason(output: RewrittenMessageOutput, original: string): string | null {
  const message = clean(output.message)
  if (message.length < MIN_MESSAGE_LENGTH) return "the rewritten message is empty"
  const invented = findPlaceholders(message).filter((placeholder) => !original.includes(placeholder))
  if (invented.length > 0) return `the message contains a placeholder (${invented.join(", ")})`
  return null
}

function shortenRequest(message: string, maxChars: number): HumanMessage {
  return new HumanMessage(
    `Your message below is ${message.length.toLocaleString()} characters, and it has to be at most ${maxChars.toLocaleString()}. Say the same thing in fewer words. Keep every point, every name, number and date, and the same meaning and tone. Take out repetition and anything that adds nothing.\n\n<draft_message>\n${message}\n</draft_message>`
  )
}

/**
 * Turns one message, in any language and in any shape, into a short and clear English message
 * that says what the user meant. The original is untrusted text inside its own delimiter tags,
 * so it is the thing being rewritten and never a set of instructions to follow.
 *
 * A rewrite longer than the original is sent back once to be cut down, and the finished message
 * goes through the app's humanizer, the same last step every other writing tool ends with, so
 * what the user sends does not read as though a model wrote it.
 */
export async function rewriteMessage({ message: original, source, signal }: RewriteOptions): Promise<RewrittenMessage> {
  const { prompt } = await getMessageRewriterPrompt()
  const maxChars = rewrittenMaxChars(original.length)
  const system = renderPrompt(await loadPrompt("message-rewriter-system"), { MAX_CHARS: maxChars })
  const user = composePromptMessage(
    prompt,
    [
      {
        variable: "message",
        tag: "original_message",
        label: "The message to rewrite",
        content: original,
      },
    ],
    { max_chars: String(maxChars) }
  )

  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const write = (turn: (SystemMessage | HumanMessage)[]) =>
    generateStructuredWithFallback({
      schema: RewrittenMessageSchema,
      name: "rewritten_message",
      messages: turn,
      temperature: REWRITE_TEMPERATURE,
      signal,
      validate: (output) => findUnusableReason(output, original),
    })

  const first = await write(messages).catch((error: unknown) => {
    if (signal.aborted) throw error
    console.error("❌ Message rewrite failed on every provider:", error instanceof Error ? error.message : error)
    throw asUserFacingError(error, MESSAGE_REWRITER_MESSAGES.providerUnavailable)
  })

  let draft = clean(first.data.message)
  const draftLength = draft.length

  // Shortening is the whole job, so a rewrite that came back longer gets one more go
  if (draft.length > maxChars) {
    const shorter = await write([...messages, shortenRequest(draft, maxChars)]).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Shortening pass failed, keeping the first draft:", error instanceof Error ? error.message : error)
      return null
    })
    const shortened = shorter ? clean(shorter.data.message) : ""
    if (shortened.length >= MIN_MESSAGE_LENGTH && shortened.length < draft.length) draft = shortened
  }

  // The last step of every writing tool: the saved Humanization prompt, with the same checks
  const humanizeCap = Math.ceil(draft.length * HUMANIZE_TOLERANCE)
  const { texts, humanized } = await humanizeTexts({
    fields: [
      {
        id: "message",
        kind: "short English message the user is about to send to someone",
        text: draft,
        maxChars: humanizeCap,
        rule: "keep the same meaning, every fact and the same tone. Plain everyday English, no longer than the draft, and no greeting or sign-off the draft does not have",
      },
    ],
    signal,
  })
  const message = clean(texts.message) || draft
  const sourceLanguage = first.data.source_language.trim().slice(0, 40) || "Unknown"

  // Lengths and language only: what the user wrote is their own, so it never goes to the log
  console.info(
    "Message rewritten:",
    JSON.stringify({
      provider: first.provider,
      source,
      sourceLanguage,
      originalCharacters: original.length,
      draftCharacters: draftLength,
      characters: message.length,
      humanized,
    })
  )

  return {
    message,
    sourceLanguage,
    characterCount: message.length,
    originalCharacters: original.length,
    humanized,
  }
}
