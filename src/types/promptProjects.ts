/**
 * One project of the Prompt Creator, as the API serves it: its name, the standing instructions
 * every prompt created in it ends with, and how many prompts it holds.
 */
export interface PromptProject {
  id: string
  name: string
  instructions: string
  promptCount: number
  // The folder its prompts are filed in, which has the project's name; null until it is made
  folderId: string | null
}
