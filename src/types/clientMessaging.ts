import type { MessageChannelId } from "@/constants/clientMessaging"
import type { EditablePrompt } from "./prompts"

/**
 * One client the user writes to: who they are, the format their messages follow, and the
 * sample messages that show that format.
 */
export interface Client {
  id: string
  name: string
  country: string
  // How this client's messages are laid out, in the user's own words
  messageFormat: string
  // Real messages sent to this client before, used only as reference for the shape
  sampleMessages: string[]
  createdAt: string
  updatedAt: string
}

export interface ClientInput {
  name: string
  country: string
  messageFormat: string
  sampleMessages: string[]
}

export interface GeneratedClientMessage {
  // The saved record, so later edits go back to the same row
  id: string
  message: string
  // Email only; every other channel sends the message on its own
  subject: string | null
  clientId: string
  clientName: string
  channel: MessageChannelId
  characterCount: number
  maxCharacters: number
  warning: string | null
}

export type ClientMessagePrompt = EditablePrompt
