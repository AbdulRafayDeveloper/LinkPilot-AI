import { Users, type LucideIcon } from "lucide-react"

/**
 * Where a client message is sent. Each channel decides the length and the shape of the
 * message (only email has a subject line); the wording rules live in the editable prompt.
 * Adding a channel means adding an entry here; the prompt, storage and page stay the same.
 */
export const MESSAGE_CHANNELS = [
  { id: "linkedin", label: "LinkedIn", description: "Direct message", maxChars: 1200, hasSubject: false },
  { id: "upwork", label: "Upwork", description: "Contract or job message", maxChars: 1500, hasSubject: false },
  { id: "fiverr", label: "Fiverr", description: "Order message", maxChars: 1200, hasSubject: false },
  { id: "slack", label: "Slack", description: "Workspace message", maxChars: 800, hasSubject: false },
  { id: "discord", label: "Discord", description: "Server or direct message", maxChars: 800, hasSubject: false },
  { id: "whatsapp", label: "WhatsApp", description: "Phone message", maxChars: 700, hasSubject: false },
  { id: "email", label: "Email", description: "With a subject line", maxChars: 2500, hasSubject: true },
] as const

export type MessageChannelId = (typeof MESSAGE_CHANNELS)[number]["id"]

export const MESSAGE_CHANNEL_IDS = MESSAGE_CHANNELS.map((channel) => channel.id) as [MessageChannelId, ...MessageChannelId[]]

export const DEFAULT_MESSAGE_CHANNEL: MessageChannelId = "linkedin"

export function messageChannel(channel: MessageChannelId) {
  return MESSAGE_CHANNELS.find((entry) => entry.id === channel) ?? MESSAGE_CHANNELS[0]
}

export function getChannelLabel(channel: MessageChannelId): string {
  return messageChannel(channel).label
}

// The module has one overall prompt, so the editor opens straight into it
export const CLIENT_MESSAGE_PROMPT_ID = "client-message"
export const CLIENT_MESSAGE_PROMPT_TABS = [{ id: CLIENT_MESSAGE_PROMPT_ID, label: "Client message" }]

export const CLIENT_NAME_MAX_LENGTH = 80
export const CLIENT_COUNTRY_MAX_LENGTH = 60
export const MESSAGE_FORMAT_MAX_LENGTH = 2000
export const SAMPLE_MESSAGE_MAX_LENGTH = 3000
// Every client keeps this many reference messages, so the format is never guessed from one example
export const SAMPLE_MESSAGE_COUNT = 2
export const UPDATE_MAX_LENGTH = 3000
export const SUBJECT_MAX_LENGTH = 90

export const CLIENT_MESSAGING_ENDPOINT = "/api/client-messaging"

export const CLIENT_MESSAGING_MESSAGES = {
  missingClient: "Choose the client this message is for.",
  noClients: "Add a client first, with their message format and two sample messages.",
  missingUpdate: "Write what you want to tell the client.",
  updateTooLong: `What you want to say must be under ${UPDATE_MAX_LENGTH.toLocaleString()} characters.`,
  missingChannel: "Choose where you are sending it.",
  generationFailed: "Couldn't write the message. Please try again.",
  // Managing clients
  missingName: "Give the client a name.",
  nameTooLong: `The name must be under ${CLIENT_NAME_MAX_LENGTH} characters.`,
  missingCountry: "Add the client's country.",
  countryTooLong: `The country must be under ${CLIENT_COUNTRY_MAX_LENGTH} characters.`,
  missingFormat: "Describe the message format this client expects.",
  formatTooLong: `The message format must be under ${MESSAGE_FORMAT_MAX_LENGTH.toLocaleString()} characters.`,
  missingSamples: `Paste ${SAMPLE_MESSAGE_COUNT} sample messages, so the format has real examples to follow.`,
  sampleTooLong: `Each sample message must be under ${SAMPLE_MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
  clientNotFound: "That client no longer exists.",
  loadFailed: "Couldn't load your clients.",
  saveFailed: "Couldn't save the client. Please try again.",
  deleteFailed: "Couldn't remove the client. Please try again.",
} as const

// The module's sidebar entry, listed with the other non-LinkedIn modules
export const CLIENT_MESSAGING_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "clients"
} = {
  id: "client-messaging",
  title: "Client Messaging",
  description: "Formal updates in each client's format",
  icon: Users,
  href: "/client-messaging",
  group: "clients",
}
