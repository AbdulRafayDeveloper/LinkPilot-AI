import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Prompt, type IPrompt } from "@/models/Prompt"
import { PromptRevision } from "@/models/PromptRevision"
import { ADMIN_PROMPT_MESSAGES } from "@/constants/adminPrompts"
import type { AdminPrompt, PromptModuleStats } from "@/types/adminPrompts"

/**
 * Every stored prompt, for an admin to read and change (Administration → Global AI Prompts). The
 * routes calling these require the admin role; nothing here is reachable by anyone else.
 *
 * **What is listed is what is stored**, never a list kept in code: the modules are the `tool` values
 * in the collection and a module's prompts are the documents under it, so a prompt added to the
 * database by a script appears on the page with no change to the app.
 *
 * A saved prompt is read fresh by every generation (services/promptStore.ts), so a change made here
 * is what the next result anyone writes uses, on every server and every device.
 */

type StoredPrompt = Pick<IPrompt, "key" | "editable" | "content" | "defaultContent" | "updatedAt">

const FIELDS = { key: 1, editable: 1, content: 1, defaultContent: 1, updatedAt: 1 } as const

const toAdminPrompt = ({ key, editable, content, defaultContent, updatedAt }: StoredPrompt): AdminPrompt => {
  const isCustom = content !== defaultContent
  return {
    key,
    editable,
    prompt: content,
    defaultPrompt: defaultContent,
    isCustom,
    updatedAt: isCustom ? new Date(updatedAt).toISOString() : null,
  }
}

/** Every module that has prompts stored, with how many it has and how many of them are system prompts. */
export async function listPromptModules(): Promise<PromptModuleStats[]> {
  await connectDatabase()
  const rows = await Prompt.aggregate<{ _id: string; total: number; system: number }>([
    { $group: { _id: "$tool", total: { $sum: 1 }, system: { $sum: { $cond: ["$editable", 0, 1] } } } },
    { $sort: { _id: 1 } },
  ])
  return rows.map((row) => ({ tool: row._id, total: row.total, system: row.system }))
}

/**
 * Every prompt stored under one module: its system prompts first (the rules and wording it always
 * sends the AI), then the prompts its users choose between (its tones, tunes and styles), each group
 * in key order. A module with nothing stored answers an empty list.
 */
export async function listModulePrompts(tool: string): Promise<AdminPrompt[]> {
  await connectDatabase()
  const records = (await Prompt.find({ tool }, FIELDS).sort({ editable: 1, key: 1 }).lean()) as StoredPrompt[]
  return records.map(toAdminPrompt)
}

/**
 * Saves new text for one stored prompt, whatever module it belongs to, keeping the text it replaces
 * in `prompt_revisions` so nothing an admin overwrites is lost. Saving the default text again
 * restores the default. A key that isn't stored is refused.
 */
export async function saveAdminPrompt(key: string, text: string): Promise<AdminPrompt> {
  await connectDatabase()
  const current = (await Prompt.findOne({ key }, FIELDS).lean()) as StoredPrompt | null
  if (!current) throw new UserFacingError(ADMIN_PROMPT_MESSAGES.unknownPrompt)

  const content = text.trim() === current.defaultContent.trim() ? current.defaultContent : text
  if (content === current.content) return toAdminPrompt(current)

  await PromptRevision.create({ promptKey: key, content: current.content })
  const saved = (await Prompt.findOneAndUpdate({ key }, { content }, { returnDocument: "after", runValidators: true, projection: FIELDS }).lean()) as StoredPrompt | null
  if (!saved) throw new UserFacingError(ADMIN_PROMPT_MESSAGES.unknownPrompt)
  return toAdminPrompt(saved)
}
