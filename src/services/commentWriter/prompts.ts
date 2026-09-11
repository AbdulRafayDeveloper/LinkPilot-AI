import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import { COMMENT_TUNES, commentWriterPromptKey, type CommentTuneId } from "@/constants/commentWriter"
import type { CommentTunePrompt } from "@/types/commentWriter"

/**
 * Each tune has its own Setting record and its own default template, so editing one
 * tune's prompt can never change another's.
 */
function tunePromptEntry(tune: CommentTuneId): PromptEntry {
  return { key: commentWriterPromptKey(tune), defaultPrompt: loadPrompt(`comment-writer-${tune}`) }
}

export async function getCommentWriterPrompts(): Promise<CommentTunePrompt[]> {
  const entries = COMMENT_TUNES.map((tune) => ({ tune: tune.id, entry: tunePromptEntry(tune.id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ tune, entry }, index) => ({ tune, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

export async function getActiveTunePrompt(tune: CommentTuneId): Promise<string> {
  const { prompt } = await getStoredPrompt(tunePromptEntry(tune))
  return prompt
}

export async function saveTunePrompt(tune: CommentTuneId, prompt: string): Promise<CommentTunePrompt> {
  const entry = tunePromptEntry(tune)
  const saved = await saveStoredPrompt(entry, prompt)
  return { tune, ...saved, defaultPrompt: entry.defaultPrompt }
}
