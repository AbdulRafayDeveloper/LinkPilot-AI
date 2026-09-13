import type { PromptFeedback } from "./PromptModalParts"
import type { EditablePrompt } from "@/types/prompts"

export interface EditedPrompt<Key extends string> {
  key: Key
  label: string
  prompt: string
}

interface SaveEditedPromptsResult<Key extends string, Saved extends EditablePrompt> {
  saved: Array<{ key: Key; data: Saved }>
  feedback: PromptFeedback
  // The first prompt that still needs attention, so the editor can switch to it; null when all were saved
  problemKey: Key | null
}

const joinLabels = (prompts: Array<{ label: string }>) => prompts.map((prompt) => prompt.label).join(", ")

/**
 * Saves every prompt edited in an open editor with one click. Each prompt has its own record,
 * so they are saved in parallel and a failed one never stops the others; the ones that failed
 * stay edited so the user can fix them and save again.
 */
export async function saveEditedPrompts<Key extends string, Saved extends EditablePrompt>(
  edited: EditedPrompt<Key>[],
  save: (key: Key, prompt: string) => Promise<{ data: Saved; message?: string }>,
): Promise<SaveEditedPromptsResult<Key, Saved>> {
  // Nothing is saved while any edited prompt is blank, so a half-saved set can't come from it
  const empty = edited.filter((prompt) => !prompt.prompt.trim())
  if (empty.length > 0) {
    return {
      saved: [],
      feedback: {
        type: "error",
        message: `${joinLabels(empty)} ${empty.length === 1 ? "is" : "are"} empty. Write a prompt or restore the default, then save.`,
      },
      problemKey: empty[0].key,
    }
  }

  const results = await Promise.allSettled(edited.map((prompt) => save(prompt.key, prompt.prompt)))
  const saved: Array<{ key: Key; data: Saved }> = []
  const savedPrompts: EditedPrompt<Key>[] = []
  const failed: Array<EditedPrompt<Key> & { reason: string }> = []
  let serverMessage: string | undefined
  results.forEach((result, index) => {
    const prompt = edited[index]
    if (result.status === "fulfilled") {
      saved.push({ key: prompt.key, data: result.value.data })
      savedPrompts.push(prompt)
      serverMessage = result.value.message
    } else {
      failed.push({ ...prompt, reason: result.reason instanceof Error ? result.reason.message : "Couldn't save the prompt." })
    }
  })

  if (failed.length === 0) {
    const message = saved.length === 1 ? serverMessage || "Prompt saved." : `${saved.length} prompts saved.`
    return { saved, feedback: { type: "success", message }, problemKey: null }
  }

  const reasons = failed.map((prompt) => `${prompt.label}: ${prompt.reason}`).join(" ")
  const message =
    savedPrompts.length > 0 ? `Saved ${joinLabels(savedPrompts)}. Couldn't save ${reasons}` : `Couldn't save ${reasons}`
  return { saved, feedback: { type: "error", message }, problemKey: failed[0].key }
}
