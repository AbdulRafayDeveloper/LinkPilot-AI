import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { CreatedPromptModel, type ICreatedPrompt } from "@/models/CreatedPrompt"
import { PROMPT_CREATOR_MESSAGES, type PromptTargetId } from "@/constants/promptCreator"
import type { CreatedPrompt, RequestSource } from "@/types/promptCreator"
import type { GeneratedPrompt } from "./generate"

type StoredCreatedPrompt = ICreatedPrompt & { _id: { toString: () => string } }

const ID_PATTERN = /^[0-9a-f]{24}$/

function toCreatedPrompt(record: StoredCreatedPrompt): CreatedPrompt {
  return {
    id: record._id.toString(),
    name: record.name,
    prompt: record.prompt,
    target: record.target as PromptTargetId,
    request: record.request,
    requestSource: record.requestSource,
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
  created: GeneratedPrompt,
  request: { text: string; source: RequestSource }
): Promise<CreatedPrompt> {
  await connectDatabase()
  const record = await CreatedPromptModel.create({
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
 * changed, and the record is marked as edited by hand.
 */
export async function updateCreatedPrompt(id: string, changes: { name?: string; prompt?: string }): Promise<CreatedPrompt> {
  if (!ID_PATTERN.test(id)) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  await connectDatabase()
  const updated = await CreatedPromptModel.findByIdAndUpdate(
    id,
    { ...changes, editedAt: new Date() },
    { returnDocument: "after", runValidators: true }
  ).lean()
  if (!updated) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  return toCreatedPrompt(updated as unknown as StoredCreatedPrompt)
}
