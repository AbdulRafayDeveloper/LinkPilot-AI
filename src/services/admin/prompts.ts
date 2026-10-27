import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { Prompt, type IPrompt } from "@/models/Prompt"
import { PromptRevision } from "@/models/PromptRevision"
import { ADMIN_PROMPT_MESSAGES, ADMIN_PROMPT_TOOLS } from "@/constants/adminPrompts"
import type { EditablePrompt } from "@/types/prompts"

/**
 * The system prompts of one module, for an admin to read and change (Administration → Global AI
 * Prompts → System prompts). The routes calling these require the admin role; nothing here is
 * reachable by anyone else.
 *
 * A saved prompt is read fresh by every generation (services/promptStore.ts), so a change made here
 * is what the next result anyone writes uses, on every server and every device.
 */

export interface AdminPrompt extends EditablePrompt {
  key: string
}

type StoredPrompt = Pick<IPrompt, "key" | "content" | "defaultContent" | "updatedAt">

const toAdminPrompt = ({ key, content, defaultContent, updatedAt }: StoredPrompt): AdminPrompt => {
  const isCustom = content !== defaultContent
  return { key, prompt: content, defaultPrompt: defaultContent, isCustom, updatedAt: isCustom ? new Date(updatedAt).toISOString() : null }
}

/**
 * Every system prompt stored under one module, alphabetically. The prompts its users choose between
 * (`editable: true`) are left to the module's own editor, so the two never offer the same prompt twice.
 */
export async function listSystemPrompts(tool: string): Promise<AdminPrompt[]> {
  if (!ADMIN_PROMPT_TOOLS.includes(tool)) throw new UserFacingError(ADMIN_PROMPT_MESSAGES.unknownTool)
  await connectDatabase()
  const records = (await Prompt.find({ tool, editable: false }, { key: 1, content: 1, defaultContent: 1, updatedAt: 1 })
    .sort({ key: 1 })
    .lean()) as StoredPrompt[]
  return records.map(toAdminPrompt)
}

/**
 * Saves new text for one stored prompt, system prompts included, keeping the text it replaces in
 * `prompt_revisions` so nothing an admin overwrites is lost. Saving the default text again restores
 * the default. A key that isn't stored, or belongs to a module an admin can't edit here, is refused.
 */
export async function saveAdminPrompt(key: string, text: string): Promise<AdminPrompt> {
  await connectDatabase()
  const current = (await Prompt.findOne({ key, tool: { $in: ADMIN_PROMPT_TOOLS } }).lean()) as StoredPrompt | null
  if (!current) throw new UserFacingError(ADMIN_PROMPT_MESSAGES.unknownPrompt)

  const content = text.trim() === current.defaultContent.trim() ? current.defaultContent : text
  if (content === current.content) return toAdminPrompt(current)

  await PromptRevision.create({ promptKey: key, content: current.content })
  const saved = (await Prompt.findOneAndUpdate({ key }, { content }, { returnDocument: "after", runValidators: true }).lean()) as StoredPrompt | null
  if (!saved) throw new UserFacingError(ADMIN_PROMPT_MESSAGES.unknownPrompt)
  return toAdminPrompt(saved)
}
