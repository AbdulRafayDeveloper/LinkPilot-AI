import { connectDB } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Setting } from "@/models/Setting"
import type { StoredPrompt } from "@/types/prompts"

export interface PromptEntry {
  key: string
  defaultPrompt: string
}

async function connectSettingsStore() {
  try {
    await connectDB()
  } catch {
    throw new UserFacingError("The prompt settings database is unavailable. Check MONGODB_URI and try again.")
  }
}

/**
 * Resolves several editable prompts in one query. Each is the saved custom value from
 * the Setting collection when present, otherwise its default template.
 */
export async function getStoredPrompts(entries: PromptEntry[]): Promise<StoredPrompt[]> {
  await connectSettingsStore()
  const saved = await Setting.find({ key: { $in: entries.map((entry) => entry.key) } }).lean()
  const savedByKey = new Map(saved.map((setting) => [setting.key, setting]))

  return entries.map(({ key, defaultPrompt }) => {
    const setting = savedByKey.get(key)
    return setting?.value.trim()
      ? { prompt: setting.value, isCustom: true, updatedAt: setting.updatedAt.toISOString() }
      : { prompt: defaultPrompt, isCustom: false, updatedAt: null }
  })
}

export async function getStoredPrompt(entry: PromptEntry): Promise<StoredPrompt> {
  const [prompt] = await getStoredPrompts([entry])
  return prompt
}

/**
 * Persists one prompt under its own key. Saving text identical to the default removes
 * the custom record, so future improvements to the default template apply again.
 */
export async function saveStoredPrompt({ key, defaultPrompt }: PromptEntry, prompt: string): Promise<StoredPrompt> {
  await connectSettingsStore()

  if (prompt.trim() === defaultPrompt) {
    await Setting.deleteOne({ key })
    return { prompt: defaultPrompt, isCustom: false, updatedAt: null }
  }

  const saved = await Setting.findOneAndUpdate(
    { key },
    { value: prompt },
    { upsert: true, new: true, runValidators: true }
  ).lean()
  if (!saved) {
    throw new Error(`PromptSaveException: Settings store returned no document for '${key}'`)
  }
  return { prompt: saved.value, isCustom: true, updatedAt: saved.updatedAt.toISOString() }
}
