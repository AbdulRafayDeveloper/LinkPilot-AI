/**
 * One project of the Prompt Creator, as the API serves it: its name, the standing instructions
 * every prompt created in it ends with, and how many prompts it holds.
 */
export interface PromptProject {
  id: string
  name: string
  instructions: string
  promptCount: number
}

/** One of a project's prompts, as its own list shows it. */
export interface ProjectPrompt {
  id: string
  name: string
  prompt: string
  target: string
  createdAt: string
  // When the user last changed it by hand, or null
  editedAt: string | null
  // When the user marked it as one they have used, or null while it is unused
  appliedAt: string | null
}
