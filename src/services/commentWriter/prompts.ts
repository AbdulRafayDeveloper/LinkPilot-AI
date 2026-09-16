import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { COMMENT_TUNES, type CommentTuneId } from "@/constants/commentWriter"
import type { CommentTunePrompt } from "@/types/commentWriter"

/**
 * Each tune has its own prompt record, so editing one tune's prompt can never change another's.
 */
const tunePromptName = (tune: CommentTuneId): PromptName => `comment-writer-${tune}`

export async function getCommentWriterPrompts(): Promise<CommentTunePrompt[]> {
  const stored = await getStoredPrompts(COMMENT_TUNES.map((tune) => tunePromptName(tune.id)))
  return COMMENT_TUNES.map((tune, index) => ({ tune: tune.id, ...stored[index] }))
}

export async function getActiveTunePrompt(tune: CommentTuneId): Promise<string> {
  const { prompt } = await getStoredPrompt(tunePromptName(tune))
  return prompt
}

export async function saveTunePrompt(tune: CommentTuneId, prompt: string): Promise<CommentTunePrompt> {
  return { tune, ...(await saveStoredPrompt(tunePromptName(tune), prompt)) }
}
