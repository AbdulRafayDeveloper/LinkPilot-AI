import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { escapeForSearch } from "@/lib/listQuery"
import { CreatedPromptModel } from "@/models/CreatedPrompt"
import { PromptProjectModel, type IPromptProject } from "@/models/PromptProject"
import { MAX_PROJECTS, PROJECT_PROMPTS_PAGE_SIZE, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import type { ProjectPrompt, PromptProject } from "@/types/promptProjects"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { folderForProjectName, renameFolder } from "@/services/promptCreator/folders"

/**
 * The projects an account writes prompts for.
 *
 * A project holds nothing itself: each prompt carries the id of the project it was written for
 * (`projectId` on `created_prompts`, null for one written outside any project), so deleting a
 * project only frees its prompts rather than deleting them. A project also keeps the standing
 * instructions every prompt created in it ends with (`appendInstructions`).
 *
 * **Every project has a folder with its name** (`folderId`), made with the project, so the prompts
 * written in it are filed together without anyone moving them: a saved prompt written in a project
 * goes straight into that folder. The folder is an ordinary folder the user can rename, move prompts
 * out of or delete; a project whose folder is gone gets one again the next time a prompt is written in
 * it (`ensureProjectFolder`), which is also how a project made before folders were linked gets one.
 * Deleting a project keeps its folder, so the prompts filed there stay where the user expects them.
 */

type StoredProject = Pick<IPromptProject, "name" | "instructions"> & { folderId?: string | null; _id: { toString: () => string } }

const toProject = (record: StoredProject, promptCount: number): PromptProject => ({
  id: record._id.toString(),
  name: record.name,
  instructions: record.instructions ?? "",
  promptCount,
  folderId: record.folderId ?? null,
})

/**
 * The folder a project's prompts are filed in, made (or found by name) when it is missing, and linked
 * to the project so a later rename of either never loses it. Never throws: a prompt is still saved,
 * in no folder, if the folder cannot be had, because filing is a convenience and writing is the job.
 */
export async function ensureProjectFolder(viewer: Viewer, project: Pick<PromptProject, "id" | "name" | "folderId">): Promise<string | null> {
  try {
    const folderId = await folderForProjectName(viewer, project.name, project.folderId)
    if (folderId !== project.folderId) {
      await PromptProjectModel.updateOne({ ...visibleTo(viewer), _id: new mongoose.Types.ObjectId(project.id) }, { $set: { folderId } })
    }
    return folderId
  } catch (error: unknown) {
    console.error("Project folder Exception:", error instanceof Error ? error.message : error)
    return null
  }
}

// Two projects called "Clinic app" and "clinic app" would be the same project to a reader, so the
// name is matched without case. The name is stored exactly as it was typed
const sameName = (name: string) => new RegExp(`^${escapeForSearch(name)}$`, "i")

/** Every project the viewer may see, by name, each with how many prompts were written in it. */
export async function listProjects(viewer: Viewer): Promise<PromptProject[]> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const [records, counts] = await Promise.all([
    PromptProjectModel.find(scope, { name: 1, instructions: 1 }).sort({ name: 1 }).lean(),
    CreatedPromptModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { ...scope, projectId: { $ne: null } } },
      { $group: { _id: "$projectId", count: { $sum: 1 } } },
    ]),
  ])
  const byProject = new Map(counts.map((row) => [String(row._id), row.count]))
  const stored = records as unknown as StoredProject[]
  return stored.map((record) => toProject(record, byProject.get(record._id.toString()) ?? 0))
}

/** Adds a project. A name another project already has, whatever its case, is refused. */
export async function createProject(viewer: Viewer, input: { name: string; instructions: string }): Promise<PromptProject> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  if ((await PromptProjectModel.countDocuments(scope)) >= MAX_PROJECTS) throw new UserFacingError(PROMPT_PROJECT_MESSAGES.tooMany)
  if (await PromptProjectModel.exists({ ...scope, name: sameName(input.name) })) throw new UserFacingError(PROMPT_PROJECT_MESSAGES.duplicate)
  const record = await PromptProjectModel.create({ ownerId: viewer.id, name: input.name, instructions: input.instructions })
  const project = toProject(record.toObject() as unknown as StoredProject, 0)
  // Its folder is made with it, so it shows among the folders straight away
  return { ...project, folderId: await ensureProjectFolder(viewer, project) }
}

/** Changes a project's name, its instructions, or both. Null when it is gone or another account's. */
export async function updateProject(
  viewer: Viewer,
  id: string,
  changes: { name?: string; instructions?: string }
): Promise<PromptProject | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const scope = visibleTo(viewer)
  if (
    changes.name !== undefined &&
    (await PromptProjectModel.exists({ ...scope, _id: { $ne: new mongoose.Types.ObjectId(id) }, name: sameName(changes.name) }))
  ) {
    throw new UserFacingError(PROMPT_PROJECT_MESSAGES.duplicate)
  }
  const record = (await PromptProjectModel.findOneAndUpdate(filter, changes, { returnDocument: "after" }).lean()) as unknown as StoredProject | null
  if (!record) return null
  // Its folder follows a new name. A folder that already has that name is left alone rather than
  // made into a second one, and a failure here never undoes the project's own rename
  if (changes.name !== undefined && record.folderId) {
    await renameFolder(viewer, record.folderId, changes.name).catch(() => null)
  }
  const promptCount = await CreatedPromptModel.countDocuments({ ...scope, projectId: id })
  return toProject(record, promptCount)
}

/**
 * Deletes one project and takes its prompts out of it. The prompts themselves are kept, and show
 * under "No project" afterwards. Returns how many were freed, or null when the project is gone or
 * belongs to another account.
 */
export async function deleteProject(viewer: Viewer, id: string): Promise<{ freed: number } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const { deletedCount } = await PromptProjectModel.deleteOne(filter)
  if (deletedCount === 0) return null
  const { modifiedCount } = await CreatedPromptModel.updateMany({ ...visibleTo(viewer), projectId: id }, { $set: { projectId: null } })
  return { freed: modifiedCount }
}

/** The project a prompt is being written for: its id when the viewer may use it, null for none. */
export async function projectForPrompt(viewer: Viewer, projectId: string | null): Promise<PromptProject | null> {
  if (!projectId) return null
  const filter = visibleById(viewer, projectId)
  if (!filter) throw new UserFacingError(PROMPT_PROJECT_MESSAGES.notFound)
  await connectDatabase()
  const record = (await PromptProjectModel.findOne(filter, { name: 1, instructions: 1, folderId: 1 }).lean()) as unknown as StoredProject | null
  if (!record) throw new UserFacingError(PROMPT_PROJECT_MESSAGES.notFound)
  return toProject(record, 0)
}

/** The prompts written in one project, newest first. Null when it is gone or another account's. */
export async function listProjectPrompts(viewer: Viewer, id: string): Promise<ProjectPrompt[] | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  if (!(await PromptProjectModel.exists(filter))) return null
  const records = await CreatedPromptModel.find({ ...visibleTo(viewer), projectId: id }, { name: 1, prompt: 1, target: 1, editedAt: 1, appliedAt: 1, createdAt: 1 })
    .sort({ createdAt: -1, _id: -1 })
    .limit(PROJECT_PROMPTS_PAGE_SIZE)
    .lean()
  return records.map((record) => ({
    id: String(record._id),
    name: record.name,
    prompt: record.prompt,
    target: record.target,
    createdAt: new Date(record.createdAt).toISOString(),
    editedAt: record.editedAt ? new Date(record.editedAt).toISOString() : null,
    appliedAt: record.appliedAt ? new Date(record.appliedAt).toISOString() : null,
  }))
}
