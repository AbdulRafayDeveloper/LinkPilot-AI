import { connectDatabase } from "@/lib/db"
import { Prompt, type IPrompt } from "@/models/Prompt"
import { PromptRevision } from "@/models/PromptRevision"
import type { PromptName } from "@/services/prompts"
import type { EditablePrompt } from "@/types/prompts"

type PromptRecord = Pick<IPrompt, "key" | "content" | "defaultContent" | "updatedAt">

async function findPrompts(names: readonly PromptName[]): Promise<Map<string, PromptRecord>> {
  await connectDatabase()
  const records = await Prompt.find({ key: { $in: names } }, { key: 1, content: 1, defaultContent: 1, updatedAt: 1 }).lean()
  const byKey = new Map<string, PromptRecord>(records.map((record) => [record.key, record]))
  const missing = names.filter((name) => !byKey.has(name))
  if (missing.length > 0) {
    throw new Error(`PromptTemplateMissing: ${missing.join(", ")} not found in the prompts collection`)
  }
  return byKey
}

function toEditablePrompt({ content, defaultContent, updatedAt }: PromptRecord): EditablePrompt {
  const isCustom = content !== defaultContent
  return { prompt: content, defaultPrompt: defaultContent, isCustom, updatedAt: isCustom ? updatedAt.toISOString() : null }
}

/**
 * The current text of one template, for building a generation's messages.
 *
 * **Read fresh every time, never cached.** An admin's save has to reach every account on every
 * device at once, and on a serverless host each request may land on a different server: a cache per
 * process (it was 60 seconds) was cleared only on the server that took the save, so the others went
 * on writing with the old prompt for up to a minute. One indexed read by key costs nothing beside the
 * AI call it feeds.
 */
export async function loadPromptText(name: PromptName): Promise<string> {
  return (await findPrompts([name])).get(name)?.content ?? ""
}

/**
 * Several editable prompts in one query, in the order asked, each with its default text.
 * Always read fresh, so a generation uses the prompt exactly as last saved.
 */
export async function getStoredPrompts(names: readonly PromptName[]): Promise<EditablePrompt[]> {
  const byKey = await findPrompts(names)
  return names.map((name) => toEditablePrompt(byKey.get(name) as PromptRecord))
}

export async function getStoredPrompt(name: PromptName): Promise<EditablePrompt> {
  const [prompt] = await getStoredPrompts([name])
  return prompt
}

/**
 * Saves new text for one editable prompt and keeps the text it replaces in prompt_revisions.
 * Saving the default text again restores the default.
 */
export async function saveStoredPrompt(name: PromptName, prompt: string): Promise<EditablePrompt> {
  await connectDatabase()
  const current = await Prompt.findOne({ key: name, editable: true }).lean()
  if (!current) {
    throw new Error(`PromptSaveException: '${name}' is not an editable prompt in the prompts collection`)
  }

  const content = prompt.trim() === current.defaultContent ? current.defaultContent : prompt
  if (content === current.content) return toEditablePrompt(current)

  await PromptRevision.create({ promptKey: name, content: current.content })
  const saved = await Prompt.findOneAndUpdate({ key: name }, { content }, { returnDocument: "after", runValidators: true }).lean()
  if (!saved) {
    throw new Error(`PromptSaveException: the prompts collection returned no document for '${name}'`)
  }
  return toEditablePrompt(saved)
}
