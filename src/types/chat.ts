/**
 * What every chat in the app has in common, whatever it answers from (a meeting, the person's own
 * profile): a message with its author and the provider that wrote it, and the events an answer is
 * streamed as. components/ui/AiChatPanel draws any chat that fits this.
 */
export interface AiChatMessage {
  id: string
  role: "you" | "assistant"
  text: string
  provider: string | null
  createdAt: string
}

export type AiChatEvent<M extends AiChatMessage> =
  | { status: "TOKEN"; text: string }
  | { status: "COMPLETE"; message: M }
  | { status: "ERROR"; message: string }
