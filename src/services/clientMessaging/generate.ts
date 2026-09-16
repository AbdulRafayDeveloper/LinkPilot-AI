import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import {
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

const ClientMessageSchema = z.object({
  subject: z
    .string()
    .nullable()
    .describe("The email subject line, or null for every channel that has no subject"),
  message: z.string().describe("The complete message text, ready to paste, and nothing else"),
})

type ClientMessageOutput = z.infer<typeof ClientMessageSchema>

interface GenerateOptions {
  client: Client
  update: string
  channel: MessageChannelId
  signal: AbortSignal
}

/**
 * The client's own name and its parts, which the message must never use: these messages are
 * addressed to the client, so naming them adds nothing and often reads wrong in a thread.
 */
function nameMentions(name: string, text: string): string[] {
  const parts = [name, ...name.split(/\s+/)].filter((part) => part.length >= MIN_NAME_PART)
  const haystack = text.toLowerCase()
  return [...new Set(parts.filter((part) => new RegExp(`\b${escapeRegExp(part.toLowerCase())}\b`).test(haystack)))]
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\]/g, "\$&")

/**
 * Writes one formal message for a client, in that client's own format, using the module's
 * overall prompt. The client's format, samples and what the user wants to say are all
 * untrusted text inside their own delimiter tags.
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

  const findUnusableReason = (output: ClientMessageOutput): string | null => {
    const message = cleanGeneratedText(output.message)
    if (!message) return "empty message"
    if (containsPlaceholder(message)) return "message contains a placeholder"
    const mentioned = nameMentions(client.name, `${message} ${output.subject ?? ""}`)
    if (mentioned.length > 0) return `the message names the client (${mentioned.join(", ")})`
    return null
  }

  const { data, provider } = await generateStructuredWithFallback({
    schema: ClientMessageSchema,
    name: "client_message",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  })

  const message = cleanGeneratedText(data.message)
  const subject = hasSubject ? cleanGeneratedText(data.subject ?? "").slice(0, SUBJECT_MAX_LENGTH) || null : null
  const leaked = nameMentions(client.name, `${message} ${subject ?? ""}`)

  const warnings = [
    leaked.length > 0 && `This message still names the client (${leaked.join(", ")}). Take the name out before sending.`,
    message.length > maxChars &&
      `This message is ${message.length.toLocaleString()} characters, over the ${maxChars.toLocaleString()} this channel is meant for. Shorten it before sending.`,
  ].filter((warning): warning is string => typeof warning === "string")

  console.info(
    "Client message generated:",
    JSON.stringify({ channel, provider, country: client.country, namesClient: leaked.length > 0, characters: message.length })
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
