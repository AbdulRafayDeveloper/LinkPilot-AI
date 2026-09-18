import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { cleanDependencyIds, findLoop, pendingDependencies } from "@/lib/promptDependencies"
import { DEPENDENCY_CHOICES, PROMPT_DEPENDENCY_MESSAGES, describePending } from "@/constants/promptDependencies"
import { PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"
import { escapeForSearch } from "@/lib/listQuery"
import { UNFILED_FOLDER } from "@/constants/promptFolders"
import { folderNames } from "@/services/promptCreator/folders"
import type { PromptDependency } from "@/types/promptCreator"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * What a prompt waits for, kept as ids on the prompt itself (`dependencyIds`), the way a folder is.
 *
 * A prompt has run when it has been applied, so a prompt is blocked while any prompt it waits for is
 * still unapplied. Everything here is scoped to the viewer, so a prompt can only ever wait for one
 * the same account may see, and a dependency that has been deleted is taken out rather than left to
 * block the prompt for ever.
 */

type IdRow = { _id: { toString: () => string } }
type NamedRow = IdRow & { name?: unknown; appliedAt?: unknown }

const asId = (id: string) => new mongoose.Types.ObjectId(id)
const isRecordId = (id: string) => /^[0-9a-f]{24}$/.test(id)

const named = (row: NamedRow): PromptDependency => ({
  id: row._id.toString(),
  name: typeof row.name === "string" ? row.name : "",
  appliedAt: row.appliedAt ? new Date(row.appliedAt as string | number | Date).toISOString() : null,
})

/**
 * The prompts named by `ids` that really exist and the viewer may see, by id. An id nothing comes
 * back for has been deleted, and the callers drop it rather than showing a gap.
 */
export async function namedDependencies(viewer: Viewer, ids: readonly string[]): Promise<Map<string, PromptDependency>> {
  const wanted = [...new Set(ids.filter(isRecordId))]
  if (wanted.length === 0) return new Map()
  await connectDatabase()
  const rows = (await CreatedPromptModel.find({ ...visibleTo(viewer), _id: { $in: wanted.map(asId) } }, { name: 1, appliedAt: 1 })
    .lean()) as unknown as NamedRow[]
  return new Map(rows.map((row) => [row._id.toString(), named(row)]))
}

/** One prompt's dependencies in the order it waits for them, with the deleted ones left out. */
export const dependenciesOf = (ids: readonly string[], byId: Map<string, PromptDependency>): PromptDependency[] =>
  ids.map((id) => byId.get(id)).filter((dependency): dependency is PromptDependency => dependency !== undefined)

/**
 * The ids that block anything: the prompts some prompt waits for that exist and have not run yet.
 * Only ids that are really waited on are looked at, so this stays small however many prompts the
 * account has, and the three filters are worked out from it in the database.
 */
export async function blockingIds(viewer: Viewer): Promise<string[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const used = ((await CreatedPromptModel.distinct("dependencyIds", scope)) as unknown[])
    .map((id) => (typeof id === "string" ? id : ""))
    .filter(isRecordId)
  if (used.length === 0) return []
  // A dependency that has been deleted can never run, so it is not counted as blocking
  const rows = (await CreatedPromptModel.find(
    { ...scope, _id: { $in: [...new Set(used)].map(asId) }, appliedAt: null },
    { _id: 1 }
  ).lean()) as unknown as IdRow[]
  return rows.map((row) => row._id.toString())
}

/**
 * Which prompts a folder choice keeps: one folder, the ones in none, or all of them. "None" is decided
 * against the folders the viewer really has, the same rule the history's folder filter follows, so a
 * prompt the page shows under No folder is listed under No folder here too.
 */
async function inFolder(viewer: Viewer, folder: string | undefined): Promise<Record<string, unknown>> {
  if (!folder) return {}
  if (folder !== UNFILED_FOLDER) return { folderId: folder }
  return { folderId: { $nin: [...(await folderNames(viewer)).keys()] } }
}

/**
 * What a prompt may wait for: its own account's other prompts, newest first, narrowed by a search
 * and a folder (the picker starts on the prompt's own folder, where most of what it waits for lives).
 * The ones it already waits for are always included, whatever folder they are in, so a dependency
 * further down the history or in another folder is still shown as picked.
 */
export async function dependencyChoices(
  viewer: Viewer,
  options: { search?: string; folder?: string; exclude?: string; include?: string[] }
): Promise<PromptDependency[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const search = (options.search ?? "").trim()
  const filter: Record<string, unknown> = {
    ...scope,
    ...(await inFolder(viewer, options.folder)),
    ...(options.exclude && isRecordId(options.exclude) ? { _id: { $ne: asId(options.exclude) } } : {}),
    ...(search ? { name: { $regex: escapeForSearch(search), $options: "i" } } : {}),
  }
  const rows = (await CreatedPromptModel.find(filter, { name: 1, appliedAt: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .limit(DEPENDENCY_CHOICES)
    .lean()) as unknown as NamedRow[]
  const choices = rows.map(named)
  // Whatever it already waits for is shown as picked, even when the search or the limit hides it
  const missing = (options.include ?? []).filter((id) => !choices.some((choice) => choice.id === id))
  if (missing.length === 0) return choices
  const byId = await namedDependencies(viewer, missing)
  return [...dependenciesOf(missing, byId), ...choices]
}

/**
 * Checks what a prompt is to wait for before it is saved: each one must exist and be the viewer's to
 * see, a prompt can't wait for itself, and the change must not make a loop, which would leave every
 * prompt in it blocked for ever. Answers the ids to save, tidied.
 */
export async function dependenciesToSave(viewer: Viewer, id: string, asked: readonly string[]): Promise<string[]> {
  const ids = cleanDependencyIds(asked, id)
  if (asked.some((wanted) => wanted.trim() === id)) throw new UserFacingError(PROMPT_DEPENDENCY_MESSAGES.itself)
  if (ids.length === 0) return []
  if (ids.some((wanted) => !isRecordId(wanted))) throw new UserFacingError(PROMPT_DEPENDENCY_MESSAGES.missing)

  await connectDatabase()
  const scope = visibleTo(viewer)
  const found = await CreatedPromptModel.countDocuments({ ...scope, _id: { $in: ids.map(asId) } })
  if (found !== ids.length) throw new UserFacingError(PROMPT_DEPENDENCY_MESSAGES.missing)

  // Every other prompt's own dependencies, so a loop is caught before it is written
  const rows = (await CreatedPromptModel.find(scope, { dependencyIds: 1 }).lean()) as unknown as (IdRow & { dependencyIds?: unknown })[]
  const waitsFor = new Map<string, string[]>(
    rows.map((row) => [row._id.toString(), Array.isArray(row.dependencyIds) ? (row.dependencyIds as string[]) : []])
  )
  if (findLoop(id, ids, waitsFor)) throw new UserFacingError(PROMPT_DEPENDENCY_MESSAGES.loop)
  return ids
}

/**
 * Refuses to mark a prompt as run while it still waits for prompts that haven't. The message names
 * them, so the answer says what to run rather than only that this can't be.
 */
export async function assertCanRun(viewer: Viewer, id: string): Promise<void> {
  const filter = visibleById(viewer, id)
  if (!filter) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  await connectDatabase()
  const record = (await CreatedPromptModel.findOne(filter, { dependencyIds: 1 }).lean()) as unknown as { dependencyIds?: unknown } | null
  if (!record) throw new UserFacingError(PROMPT_CREATOR_MESSAGES.notFound)
  const ids = Array.isArray(record.dependencyIds) ? (record.dependencyIds as string[]) : []
  if (ids.length === 0) return
  const byId = await namedDependencies(viewer, ids)
  const pending = pendingDependencies(dependenciesOf(ids, byId))
  if (pending.length > 0) throw new BlockedByDependencies(describePending(pending.map((dependency) => dependency.name)))
}

/** A prompt asked to run before what it waits for. Its message names the prompts to run first. */
export class BlockedByDependencies extends UserFacingError {}

/**
 * Takes deleted prompts out of everything that waited for them, the way deleting a folder frees the
 * prompts in it. Without this a prompt would wait for something that can never run again.
 */
export async function forgetDeletedPrompts(viewer: Viewer, ids: readonly string[]): Promise<void> {
  const gone = ids.filter(isRecordId)
  if (gone.length === 0) return
  await connectDatabase()
  await CreatedPromptModel.updateMany({ ...visibleTo(viewer), dependencyIds: { $in: gone } }, { $pull: { dependencyIds: { $in: gone } } })
}
