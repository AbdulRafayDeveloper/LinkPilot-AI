import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { CreatedPromptModel, type ICreatedPrompt } from "@/models/CreatedPrompt"
import { PROMPT_CREATOR_MESSAGES, type PromptTargetId } from "@/constants/promptCreator"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import type { CreatedPrompt, RequestSource } from "@/types/promptCreator"
import type { GeneratedPrompt } from "./generate"
import type { Viewer } from "@/types/auth"
import { visibleById } from "@/services/auth/viewer"

type StoredCreatedPrompt = ICreatedPrompt & { _id: { toString: () => string } }

function toCreatedPrompt(record: StoredCreatedPrompt): CreatedPrompt {
  return {
    id: record._id.toString(),
    name: record.name,
    prompt: record.prompt,
    target: record.target as PromptTargetId,
    request: record.request,
    requestSource: record.requestSource,
    folderId: record.folderId ?? null,
    provider: record.provider && record.provider in AI_PROVIDER_LABELS ? (record.provider as AiProviderId) : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/**
 * Saves a freshly written prompt, so every prompt the module creates is kept with the request
 * it came from. Unlike the LinkedIn tools' records, this one is part of the result: the page
 * needs its id to save later edits.
 */
export async function saveCreatedPrompt(
  viewer: Viewer,
  created: GeneratedPrompt,
  request: { text: string; source: RequestSource }
): Promise<CreatedPrompt> {
  await connectDatabase()
  const record = await CreatedPromptModel.create({
    ownerId: viewer.id,
    name: created.name,
    prompt: created.prompt,
    target: created.target,
    request: request.text,
    requestSource: request.source,
    provider: created.provider,
  })
  return toCreatedPrompt(record as unknown as StoredCreatedPrompt)
}

/**
 * Stores the user's own name or prompt text over the written one. Only the fields sent are
 * changed, and the record is marked as edited by hand. Another account's prompt is not found.
 */
export async function updateCreatedPrompt(
  viewer: Viewer,
  id: string,
  changes: { name?: string; prompt?: string; folderId?: string | null }
): Promise<CreatedPrompt> {
  const filter = visibleById(viewer, id)
  if (!filter) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  await connectDatabase()
  // Filing a prompt in a folder is not a change to what it says, so it doesn't count as edited by hand
  const isRewrite = changes.name !== undefined || changes.prompt !== undefined
  const updated = await CreatedPromptModel.findOneAndUpdate(
    filter,
    isRewrite ? { ...changes, editedAt: new Date() } : changes,
    { returnDocument: "after", runValidators: true }
  ).lean()
  if (!updated) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  return toCreatedPrompt(updated as unknown as StoredCreatedPrompt)
}
