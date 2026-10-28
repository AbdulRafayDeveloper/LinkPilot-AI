import type { MessageChannelId } from "@/constants/clientMessaging"
import type { ClientKind, ClientProjectStatus } from "@/constants/clients"
import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

/**
 * One client the user writes to: who they are, the format their messages follow, and the
 * sample messages that show that format.
 */
export interface Client {
  id: string
  name: string
  country: string
  // One person or a company
  kind: ClientKind
  // How this client's messages are laid out, in the user's own words
  messageFormat: string
  // Real messages sent to this client before, used only as reference for the shape
  sampleMessages: string[]
  // Every status this client's projects stand at, each once, so the list can be filtered by them
  projectStatuses: ClientProjectStatus[]
  createdAt: string
  updatedAt: string
}

export interface ClientInput {
  name: string
  country: string
  // Optional in the API: left out, a new client is an individual and an edited one keeps its kind
  kind?: ClientKind
  messageFormat: string
  sampleMessages: string[]
}

export interface GeneratedClientMessage extends WithAiSource {
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
