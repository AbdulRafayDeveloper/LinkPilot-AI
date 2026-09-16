import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { asUserFacingError } from "@/lib/errors"
import { cleanGeneratedText, findPlaceholders, stripMarkdownMarks } from "@/lib/generatedText"
import {
  CLIENT_MESSAGING_MESSAGES,
  SUBJECT_MAX_LENGTH,
  getChannelLabel,
  messageChannel,
  type MessageChannelId,
} from "@/constants/clientMessaging"
import type { Client, GeneratedClientMessage } from "@/types/clientMessaging"
import { getClientMessagePrompt } from "./prompts"

// Client updates are formal and factual, so there is little room for invention
const WRITING_TEMPERATURE = 0.5
// Name parts shorter than this are too common to search for ("Li", "De")
const MIN_NAME_PART = 3
// Targeted rewrites for a message that names the client or runs past the channel's length
const MAX_REWRITES = 2
// A rewrite is asked for only when the message is this much past the channel's length
const LENGTH_TOLERANCE = 1.15

const ClientMessageSchema = z.object({
  subject: z.string().nullable().describe("The email subject line, or null for every channel that has no subject"),
  message: z.string().describe("The complete message text, ready to paste, and nothing else"),
})

type ClientMessageOutput = z.infer<typeof ClientMessageSchema>

interface GenerateOptions {
  client: Client
  update: string
  channel: MessageChannelId
  signal: AbortSignal
}

interface MessageProblems {
  // The client's name, or parts of it, that the message uses
  names: string[]
  length: number
}

const clean = (raw: string) => stripMarkdownMarks(cleanGeneratedText(raw))

// The part as a whole word, with anything the regular expression engine would read escaped
const wordPattern = (part: string) => new RegExp(String.raw`\b${part.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}\b`, "gi")

/**
 * The client's own name and its parts, which the message must never use: these messages are
 * addressed to the client, so naming them adds nothing and often reads wrong in a thread.
 */
const nameParts = (name: string) => [name, ...name.split(/\s+/)].filter((part) => part.length >= MIN_NAME_PART)

function nameMentions(name: string, text: string): string[] {
  return [...new Set(nameParts(name).filter((part) => wordPattern(part).test(text)))]
}

// Last resort when a rewrite still names the client: take the name out and tidy what it leaves
function removeNames(name: string, text: string): string {
  return nameParts(name)
    .reduce((current, part) => current.replace(wordPattern(part), ""), text)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([,;:])(\s*[,;:])+/g, "$1")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([A-Za-z])\s+,/g, "$1,")
    .replace(/^[ \t]*[,;:]\s*/gm, "")
    .replace(/(\n[ \t]*){3,}/g, "\n\n")
    .trim()
}

function describeProblems({ names, length }: MessageProblems, maxChars: number): string[] {
  return [
    names.length > 0 &&
      `It uses the client's name (${names.join(", ")}). Take every part of their name out, including in the greeting, and greet them without a name.`,
    length > maxChars * LENGTH_TOLERANCE &&
      `It is ${length.toLocaleString()} characters, but it should be at most ${maxChars.toLocaleString()} for this channel. Keep every point of the update and cut the wording back.`,
  ].filter((problem): problem is string => typeof problem === "string")
}

/**
 * A draft is thrown away only when it is unusable. Client updates are technical, so bracketed
 * text the user themselves wrote ("[staging]") is kept; only a slot the model invented,
 * appearing nowhere in what it was given, counts as a placeholder.
 */
function findUnusableReason(output: ClientMessageOutput, sources: string): string | null {
  const message = clean(output.message)
  if (!message) return "empty message"
  const invented = findPlaceholders(message).filter((placeholder) => !sources.includes(placeholder))
  if (invented.length > 0) return `message contains a placeholder (${invented.join(", ")})`
  return null
}

/**
 * The first draft, which is the one attempt that cannot be skipped. Both providers have already
 * been tried (each with its own retries) by the time this fails, so the whole turn is asked for
 * once more before giving up: the models are random enough that a second ask usually lands.
 */
async function writeFirstDraft<T>(
  write: (turn: (SystemMessage | HumanMessage)[]) => Promise<T>,
  messages: (SystemMessage | HumanMessage)[],
  signal: AbortSignal
): Promise<T> {
  try {
    return await write(messages)
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn("↻ Client message draft failed on every provider; asking once more:", error instanceof Error ? error.message : error)
    try {
      return await write(messages)
    } catch (retryError: unknown) {
      if (signal.aborted) throw retryError
      console.error("❌ Client message draft failed twice:", retryError instanceof Error ? retryError.message : retryError)
      throw asUserFacingError(retryError, CLIENT_MESSAGING_MESSAGES.providerUnavailable)
    }
  }
}

function problemRewrite(message: string, problems: string[]): HumanMessage {
  return new HumanMessage(
    `Rewrite your draft message below. ${problems.join(" ")} Keep everything else exactly as it is: the same facts, the same order, the same format and plain text.\n\n<draft_message>\n${message}\n</draft_message>`
  )
}

/**
 * Writes one formal message for a client, in that client's own format, using the module's
 * overall prompt. The client's format, samples and what the user wants to say are all
 * untrusted text inside their own delimiter tags.
 *
 * A message that names the client, or runs well past the channel's length, is not thrown away:
 * it is sent back for up to MAX_REWRITES targeted rewrites, the cleanest version wins, and a
 * name that survives all of them is removed here, so the user always gets something to send.
 */
export async function generateClientMessage({ client, update, channel, signal }: GenerateOptions): Promise<
  Omit<GeneratedClientMessage, "id">
> {
  const { prompt } = await getClientMessagePrompt()
  const { maxChars, hasSubject } = messageChannel(channel)
  const system = renderPrompt(await loadPrompt("client-message-system"), {
    CHANNEL: getChannelLabel(channel),
    MAX_CHARS: maxChars,
    SUBJECT_RULE: hasSubject
      ? `This channel has a subject line. Write one of at most ${SUBJECT_MAX_LENGTH} characters that says what the message is about.`
      : "This channel has no subject line, so subject must be null.",
  })

  const user = composePromptMessage(
    prompt,
    [
      {
        variable: "message_format",
        tag: "message_format",
        label: "The format this client's messages follow",
        content: client.messageFormat,
      },
      {
        variable: "sample_messages",
        tag: "sample_messages",
        label: "Earlier messages to this client, for the shape only",
        content: client.sampleMessages
          .filter((sample) => sample.trim())
          .map((sample, index) => `Sample ${index + 1}:\n${sample}`)
          .join("\n\n"),
      },
      { variable: "update", tag: "update", label: "What to tell them this time", content: update },
    ],
    { channel: getChannelLabel(channel), country: client.country, max_chars: String(maxChars) }
  )

  const messages = [new SystemMessage(system), new HumanMessage(user)]
  // Everything the model was given, so brackets it copied from the user are not read as slots
  const sources = [client.messageFormat, ...client.sampleMessages, update].join(" ")
  const write = (turn: (SystemMessage | HumanMessage)[]) =>
    generateStructuredWithFallback({
      schema: ClientMessageSchema,
      name: "client_message",
      messages: turn,
      temperature: WRITING_TEMPERATURE,
      signal,
      validate: (output) => findUnusableReason(output, sources),
    })

  const first = await writeFirstDraft(write, messages, signal)
  let message = clean(first.data.message)
  let subject = hasSubject ? clean(first.data.subject ?? "").slice(0, SUBJECT_MAX_LENGTH) || null : null
  let provider = first.provider

  const findProblems = (text: string, line: string | null): MessageProblems => ({
    names: nameMentions(client.name, `${text}\n${line ?? ""}`),
    length: text.length,
  })
  let problems = describeProblems(findProblems(message, subject), maxChars)
  const draftProblems = problems.length

  // A rewrite can bring a problem back, so each one is checked again and the cleanest version wins
  for (let attempt = 0; attempt < MAX_REWRITES && problems.length > 0; attempt++) {
    const rewrite = await write([...messages, problemRewrite(message, problems)]).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Client message rewrite failed; keeping the current draft:", error instanceof Error ? error.message : error)
      return null
    })
    if (!rewrite) break
    const rewritten = clean(rewrite.data.message)
    const rewrittenSubject = hasSubject ? clean(rewrite.data.subject ?? "").slice(0, SUBJECT_MAX_LENGTH) || null : null
    const rewrittenProblems = describeProblems(findProblems(rewritten, rewrittenSubject), maxChars)
    if (!rewritten || rewrittenProblems.length > problems.length) continue
    message = rewritten
    subject = rewrittenSubject
    problems = rewrittenProblems
    provider = rewrite.provider
  }

  // The client's name must never go out, so what the rewrites left is taken out here
  const leaked = nameMentions(client.name, `${message}\n${subject ?? ""}`)
  if (leaked.length > 0) {
    message = removeNames(client.name, message)
    subject = subject ? removeNames(client.name, subject) : null
  }

  const warnings = [
    leaked.length > 0 && "The client's name was taken out of this message. Read it once before sending.",
    message.length > maxChars &&
      `This message is ${message.length.toLocaleString()} characters, over the ${maxChars.toLocaleString()} this channel is meant for. Shorten it before sending.`,
  ].filter((warning): warning is string => typeof warning === "string")

  console.info(
    "Client message generated:",
    JSON.stringify({
      channel,
      provider,
      country: client.country,
      draftProblems,
      rewrittenTo: problems.length,
      nameRemoved: leaked.length > 0,
      characters: message.length,
    })
  )

  return {
    message,
    subject,
    clientId: client.id,
    clientName: client.name,
    channel,
    characterCount: message.length,
    maxCharacters: maxChars,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  }
}
