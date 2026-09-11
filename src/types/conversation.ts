import type { ConversationState } from "@/constants/conversationState"

/**
 * Who is who in a pasted conversation and where it stands, as shown to the user so they
 * can check that the speakers were read correctly.
 */
export interface ConversationParties {
  state: ConversationState
  userName: string | null
  otherPersonName: string | null
}
