import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { CreatedPromptModel, type ICreatedPrompt } from "@/models/CreatedPrompt"
import { PROMPT_CREATOR_MESSAGES, type PromptTargetId } from "@/constants/promptCreator"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import type { CreatedPrompt, PromptDependency, RequestSource } from "@/types/promptCreator"
import { assertCanRun, dependenciesOf, dependenciesToSave, namedDependencies } from "@/services/promptCreator/dependencies"
import type { GeneratedPrompt } from "./generate"
import type { Viewer } from "@/types/auth"
import { visibleById } from "@/services/auth/viewer"

type StoredCreatedPrompt = ICreatedPrompt & { _id: { toString: () => string } }

function toCreatedPrompt(record: StoredCreatedPrompt, dependencies: PromptDependency[] = []): CreatedPrompt {
  return {
    id: record._id.toString(),
    name: record.name,
    prompt: record.prompt,
    target: record.target as PromptTargetId,
    request: record.request,
    requestSource: record.requestSource,
    folderId: record.folderId ?? null,
    projectId: record.projectId ?? null,
    appliedAt: record.appliedAt ? new Date(record.appliedAt).toISOString() : null,
    dependencies,
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
  request: { text: string; source: RequestSource },
  projectId: string | null,
  // The folder it is filed in from the start: its project's folder, or none
  folderId: string | null = null
): Promise<CreatedPrompt> {
  await connectDatabase()
  const record = await CreatedPromptModel.create({
    ownerId: viewer.id,
    name: created.name,
    prompt: created.prompt,
    target: created.target,
    request: request.text,
    requestSource: request.source,
    projectId,
    folderId,
    provider: created.provider,
  })
  return toCreatedPrompt(record as unknown as StoredCreatedPrompt)
}

/** The prompts a saved one waits for, named, with any that have been deleted left out. */
export async function dependenciesFor(viewer: Viewer, ids: readonly string[] | undefined): Promise<PromptDependency[]> {
  const waiting = ids ?? []
  if (waiting.length === 0) return []
  return dependenciesOf(waiting, await namedDependencies(viewer, waiting))
}

/**
 * Stores the user's own name or prompt text over the written one, files it, changes what it waits
 * for, or marks it as run. Only the fields sent are changed, and a rewrite marks the record as
 * edited by hand. Another account's prompt is not found.
 *
 * **A prompt is run by applying it, so it can only be applied once everything it waits for has
 * been** (services/promptCreator/dependencies.ts). The refusal names the prompts to run first.
 */
export async function updateCreatedPrompt(
  viewer: Viewer,
  id: string,
  changes: { name?: string; prompt?: string; folderId?: string | null; applied?: boolean; dependencyIds?: string[] }
): Promise<CreatedPrompt> {
  const filter = visibleById(viewer, id)
  if (!filter) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  await connectDatabase()
  // Checked before anything is written, so a blocked prompt is never marked and then put back
  if (changes.applied === true) await assertCanRun(viewer, id)
  // Filing a prompt in a folder, marking it as used, or changing what it waits for is not a change
  // to what it says, so none of them counts as edited by hand
  const { applied, dependencyIds, ...written } = changes
  const isRewrite = written.name !== undefined || written.prompt !== undefined
  const update = {
    ...written,
    ...(isRewrite ? { editedAt: new Date() } : {}),
    // Marking it applied records when; unmarking it clears that again
    ...(applied === undefined ? {} : { appliedAt: applied ? new Date() : null }),
    ...(dependencyIds === undefined ? {} : { dependencyIds: await dependenciesToSave(viewer, id, dependencyIds) }),
  }
  const updated = (await CreatedPromptModel.findOneAndUpdate(filter, update, {
    returnDocument: "after",
    runValidators: true,
  }).lean()) as unknown as StoredCreatedPrompt | null
  if (!updated) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  return toCreatedPrompt(updated, await dependenciesFor(viewer, updated.dependencyIds))
}
