import { Languages, type LucideIcon } from "lucide-react"
import { REQUEST_MAX_LENGTH } from "./promptCreator"

/**
 * The message to rewrite, typed or spoken. It is the same limit as the Prompt Creator's
 * description (`REQUEST_MAX_LENGTH`), because both take one free-text block from the same
 * two inputs, so a recording that fits one fits the other.
 */
export const MESSAGE_MAX_LENGTH = REQUEST_MAX_LENGTH

/**
 * The rewritten message is never longer than the original, which is the point of the module.
 * A note or a fragment is the exception: "mtg 3pm cancel" only becomes clear as a sentence,
 * so anything under this length may grow up to it.
 */
export const SHORT_MESSAGE_ROOM = 280

/** How long the rewrite of this message may be. */
export function rewrittenMaxChars(originalLength: number): number {
  return Math.max(originalLength, SHORT_MESSAGE_ROOM)
}

// The module has one overall prompt, so the editor opens straight into it
export const MESSAGE_REWRITER_PROMPT_ID = "message-rewriter"
export const MESSAGE_REWRITER_PROMPT_TABS = [{ id: MESSAGE_REWRITER_PROMPT_ID, label: "Message rewriter" }]

export const MESSAGE_REWRITER_ENDPOINT = "/api/message-rewriter"

export const MESSAGE_REWRITER_MESSAGES = {
  missingMessage: "Write or paste the message you want shortened, or say it out loud.",
  messageTooLong: `Your message must be under ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "Couldn't rewrite the message. Please try again.",
  providerUnavailable: "The writing model didn't answer. Please try again in a moment.",
} as const

// The module's sidebar entry, listed with the other non-LinkedIn modules
export const MESSAGE_REWRITER_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "message-rewriter",
  title: "Message Rewriter",
  description: "Any language into short English",
  icon: Languages,
  href: "/message-rewriter",
  group: "clients",
}
