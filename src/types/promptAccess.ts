export type PromptAccessState = "unlocked" | "password_required" | "locked" | "disabled"

/**
 * Whether this browser may use the Update Prompt editors right now.
 */
export interface PromptAccessStatus {
  state: PromptAccessState
  attemptsLeft: number
  // ISO timestamps
  lockedUntil: string | null
  sessionExpiresAt: string | null
}
