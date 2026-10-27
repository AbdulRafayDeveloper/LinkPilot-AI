import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { folderForItem } from "@/services/clientProjects/folders"
import { UserFacingError } from "@/lib/errors"
import { ClientProjectModel, type IClientProject } from "@/models/ClientProject"
import { ClientProjectTaskModel, type IClientProjectTask } from "@/models/ClientProjectTask"
import {
  DEFAULT_ESTIMATE_UNIT,
  DEFAULT_PROJECT_ITEM_KIND,
  MAX_PROJECT_TASKS,
  PROJECT_ITEM_KINDS,
  PROJECT_TASK_MESSAGES,
  PUBLIC_ITEM_KIND_IDS,
  PUBLIC_WRITABLE_KIND_IDS,
  SHAREABLE_KIND_IDS,
  isMovableItemKind,
  projectItemKind,
  projectPriority,
  projectItemShape,
  roadmapStage,
  type ProjectItemAuthor,
  type ProjectItemKind,
  hasFolders,
} from "@/constants/clientProjectTasks"
import { itemName, itemProblem, projectItemUrl } from "@/lib/projectItems"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { assertOwnImages, deleteOwnedTaskImages, taskImageView } from "@/services/taskImages"
import { assertOwnAttachments, ownedAttachmentIds } from "@/services/attachmentOwners"
import { deleteVoiceNotes, voiceNoteView } from "./voiceNotes"
import { deleteProjectFiles, projectFileView, storedProjectFile } from "./files"
import type { ProjectEstimate, ProjectTask, ProjectTaskInput } from "@/types/clientProjectTasks"
import type { Viewer } from "@/types/auth"

/**
 * The items on a client project, in `client_project_tasks`: its changes, its ideas and its
 * discussion, which are one collection told apart by `kind`.
 *
 * Every call through a signed-in viewer names the project first and reads it with `visibleById`, so
 * a project the viewer may not see answers as no project at all and its items can never be reached.
 * The shared link writes through `publicTasks.ts`, which resolves its one project from the signed
 * token and then uses the same three core functions here, so both surfaces share one set of rules.
 *
 * An item's images and its voice note live in S3 and are named on the item by the ids the server
 * made for them; a page receives each with a short-lived link, never a key.
 */

type StoredTask = IClientProjectTask & { _id: { toString: () => string } }
type StoredProject = IClientProject & { _id: { toString: () => string } }

/**
 * The accounts whose uploads an item may name: the project's owner (the shared link uploads for
 * them) and whoever is writing it. An image, a file or a voice note is named by an id alone, so
 * without this an item could be saved naming another account's id, show it, and delete it from
 * storage once the item let it go (services/attachmentOwners.ts).
 */
type Owners = readonly (string | null)[]

type Attachments = Pick<ProjectTaskInput, "images" | "files" | "voiceNote">

/** Refuses an item naming an image, a file or a recording none of its owners uploaded. */
async function assertOwnItemAttachments(owners: Owners, next: Partial<Attachments>, current?: Attachments): Promise<void> {
  await assertOwnImages(owners, next.images ?? [], current?.images ?? [])
  await assertOwnAttachments(
    owners,
    "project-file",
    (next.files ?? []).map((file) => file.assetId),
    (current?.files ?? []).map((file) => file.assetId),
    PROJECT_TASK_MESSAGES.attachmentNotYours
  )
  await assertOwnAttachments(
    owners,
    "voice-note",
    next.voiceNote ? [next.voiceNote.assetId] : [],
    current?.voiceNote ? [current.voiceNote.assetId] : [],
    PROJECT_TASK_MESSAGES.attachmentNotYours
  )
}

interface ItemAttachments {
  owners: Owners
  images?: StoredTask["images"]
  files?: StoredTask["files"]
  voiceNote?: StoredTask["voiceNote"]
}

/**
 * Removes from storage what items no longer name, **only the objects one of that item's owners
 * uploaded**: anything else an item names (saved before the check existed) is left for its owner.
 * The records are already gone or saved, so a storage problem leaves an orphan at worst.
 */
async function removeAttachments(entries: readonly ItemAttachments[]): Promise<void> {
  await deleteOwnedTaskImages(entries.flatMap((entry) => (entry.images ?? []).map((image) => ({ ownerId: entry.owners, image }))))
  const files = entries.flatMap((entry) => (entry.files ?? []).map((file) => ({ owners: entry.owners, file: storedProjectFile(file) })))
  const ownFiles = await ownedAttachmentIds("project-file", files.map((entry) => ({ assetId: entry.file.assetId, owners: entry.owners })))
  await deleteProjectFiles(files.filter((entry) => ownFiles.has(entry.file.assetId)).map((entry) => entry.file))
  const notes = entries.flatMap((entry) => (entry.voiceNote?.assetId ? [{ owners: entry.owners, note: entry.voiceNote }] : []))
  const ownNotes = await ownedAttachmentIds("voice-note", notes.map((entry) => ({ assetId: entry.note.assetId, owners: entry.owners })))
  await deleteVoiceNotes(notes.filter((entry) => ownNotes.has(entry.note.assetId)).map((entry) => entry.note))
}

const ID_PATTERN = /^[0-9a-f]{24}$/

/**
 * One item by its id and nothing else. The shared link's writes use this: they are already held to
 * one project by the token, so there is no account to scope them by. A signed-in viewer's writes
 * use `visibleById` instead, which also checks the account.
 */
export const taskById = (taskId: string): Record<string, unknown> | null => (ID_PATTERN.test(taskId) ? { _id: taskId } : null)

/**
 * The kinds a shared link may ever reach. `null` is in the list because it matches a row with no
 * `kind` at all, which is every item saved before the tabs existed and reads as a change.
 *
 * It is a **filter rather than a check after the fact**: added to a read it leaves the owner's own
 * tabs out of the answer, and added to a write's filter it makes an id that names one of them match
 * nothing, so a client holding the link cannot read, change or delete a credential or a backup even
 * if they somehow learned its id.
 */
export const PUBLIC_KINDS_ONLY = {
  $or: [
    // The tabs whose items are the client's to read, every one of them
    { kind: { $in: [...PUBLIC_ITEM_KIND_IDS.filter((id) => !SHAREABLE_KIND_IDS.includes(id)), null] } },
    /**
     * A note, and **only one that has been shared**. It is the one tab whose items each decide for
     * themselves, so the rule is part of the filter rather than something the page remembers to do:
     * an internal note is not in the answer at all, and its id matches nothing a link may change.
     */
    { kind: { $in: SHAREABLE_KIND_IDS }, isClientVisible: true },
  ],
} as const

/** One item by its id, held to the tabs a shared link may reach. */
export const publicTaskById = (taskId: string): Record<string, unknown> | null =>
  ID_PATTERN.test(taskId) ? { _id: taskId, ...PUBLIC_KINDS_ONLY } : null

/**
 * The kinds a shared link may **write on**, which is fewer than it may read: the roadmap and the
 * notes are the owner's own, so a client reads them and changes nothing. Held in the same three
 * places the public kinds are: the schema takes only these, this filter makes another tab's id
 * match nothing, and the reorder is held to them too.
 */
export const PUBLIC_WRITABLE_KINDS_ONLY = { kind: { $in: [...PUBLIC_WRITABLE_KIND_IDS, null] } } as const

/** One item by its id, held to the tabs a shared link may write on. */
export const publicWritableTaskById = (taskId: string): Record<string, unknown> | null =>
  ID_PATTERN.test(taskId) ? { _id: taskId, ...PUBLIC_WRITABLE_KINDS_ONLY } : null

/** The project, or null when it is gone or belongs to another account. */
export async function projectOrNull(viewer: Viewer, projectId: string): Promise<StoredProject | null> {
  const filter = visibleById(viewer, projectId)
  if (!filter) return null
  await connectDatabase()
  return (await ClientProjectModel.findOne(filter).lean()) as unknown as StoredProject | null
}

/**
 * The estimate as a page receives it, from the two flat fields it is stored in. Null unless both of
 * them are there and the number says something, so a cleared estimate and one nobody ever wrote
 * read the same.
 */
const storedEstimate = (record: Pick<IClientProjectTask, "estimateValue" | "estimateUnit">): ProjectEstimate | null =>
  record.estimateValue && record.estimateUnit
    ? { value: record.estimateValue, unit: (record.estimateUnit as ProjectEstimate["unit"]) ?? DEFAULT_ESTIMATE_UNIT }
    : null

/**
 * The next number on one tab of one project: one past the highest ever given out there, so a number
 * is never reused and an item keeps the one it was added with for good. Deleting the newest item
 * leaves a gap on purpose, because "AA Change 12" naming two different items at two different times
 * would be worse than a missing 12.
 */
async function nextNumber(projectId: string, kind: ProjectItemKind): Promise<number> {
  const highest = (await ClientProjectTaskModel.findOne({ projectId, kind }).sort({ number: -1 }).select({ number: 1 }).lean()) as {
    number?: number
  } | null
  return (highest?.number ?? 0) + 1
}

/** One item with its links signed, ready for a page. */
async function toTask(record: StoredTask): Promise<ProjectTask> {
  const [images, files, voiceNote] = await Promise.all([
    Promise.all((record.images ?? []).map((image) => taskImageView(image))),
    Promise.all((record.files ?? []).map((file) => projectFileView(storedProjectFile(file)))),
    voiceNoteView(record.voiceNote),
  ])
  return {
    id: record._id.toString(),
    projectId: record.projectId,
    content: record.content,
    description: record.description ?? "",
    url: record.url ?? "",
    // An image or a file whose link couldn't be signed is left out rather than shown broken
    images: images.filter((image) => image !== null),
    files: files.filter((file) => file !== null),
    voiceNote,
    status: record.status === "done" ? "done" : "open",
    // An item saved before the tabs existed has no kind and reads as a change, the first tab
    kind: projectItemKind(record.kind).id,
    addedBy: record.addedBy === "client" ? "client" : "owner",
    // Null at the top of the tree, and on every item saved before folders existed
    folderId: record.folderId ?? null,
    position: record.position ?? 0,
    // An item saved before priorities existed reads as Medium, so every item always has one
    priority: projectPriority(record.priority).id,
    estimate: storedEstimate(record),
    // 0 on an item saved before numbering, which reads as having no number rather than as the first
    number: record.number ?? 0,
    // Signed off as agreed, and when. Null on everything nobody has signed; who signed is not stored
    signedAt: record.signedAt ? new Date(record.signedAt).toISOString() : null,
    // Where a roadmap item has got to, and whether the client may read a note
    stage: projectItemShape(record.kind).stage ? roadmapStage(record.stage).id : null,
    isClientVisible: record.isClientVisible === true,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  }
}

/**
 * Every item of one project, in the order they are shown. Both surfaces read all three tabs in one
 * answer and split them on the page, so switching tab costs no request. The records are read by the
 * caller's scope, and the ceiling is per tab, which is also how `MAX_PROJECT_TASKS` is enforced.
 */
export async function listProjectTasks(scope: Record<string, unknown>, projectId: string): Promise<ProjectTask[]> {
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId })
    .sort({ position: 1, createdAt: 1, _id: 1 })
    // The ceiling is per tab, so a project's whole list is at most that many on each of them
    .limit(MAX_PROJECT_TASKS * PROJECT_ITEM_KINDS.length)
    .lean()) as unknown as StoredTask[]
  return Promise.all(records.map(toTask))
}

/** The items of one project for a signed-in viewer. Null when the project is gone or another account's. */
export async function tasksOfProject(viewer: Viewer, projectId: string): Promise<ProjectTask[] | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  return listProjectTasks(visibleTo(viewer), projectId)
}

const cleanInput = (input: ProjectTaskInput, kind: ProjectItemKind) => ({
  // A document and a backup may be saved with nothing typed and take their file's own name
  content: itemName(kind, input.content, input.files ?? []),
  description: input.description?.trim() ?? "",
  url: projectItemUrl(input.url ?? ""),
  images: (input.images ?? []).map((image) => ({ assetId: image.assetId, contentType: image.contentType })),
  files: (input.files ?? []).map((file) => ({
    assetId: file.assetId,
    name: file.name,
    contentType: file.contentType,
    category: file.category,
    size: file.size,
  })),
  voiceNote: input.voiceNote ? { assetId: input.voiceNote.assetId, contentType: input.voiceNote.contentType, seconds: input.voiceNote.seconds } : null,
  status: input.status === "done" ? "done" : "open",
  priority: projectPriority(input.priority).id,
  // Only the tab that asks for one keeps it, so a change carried to the backlog can gain an
  // estimate and one carried back out of it does not keep a number nothing shows
  estimateValue: projectItemShape(kind).estimate ? (input.estimate?.value ?? null) : null,
  estimateUnit: projectItemShape(kind).estimate && input.estimate?.value ? input.estimate.unit : null,
  // Only the tab that has one keeps it, the rule the estimate follows: a note carried elsewhere
  // would otherwise stay shared, and an item that is not on the roadmap would carry a stage
  stage: projectItemShape(kind).stage ? roadmapStage(input.stage).id : null,
  isClientVisible: projectItemShape(kind).shareable ? input.isClientVisible === true : false,
})

interface CreateOptions {
  // The project the item goes on, already read and already allowed
  project: StoredProject
  projectId: string
  // Whose list it joins. An item added from the shared link is the project owner's, like the project
  ownerId: string | null
  addedBy: ProjectItemAuthor
  // What counts towards the ceiling and the end of the list: the viewer's scope, or the project alone
  scope: Record<string, unknown>
}

/**
 * Adds one item to the end of its tab. The ceiling is counted per tab, so a long discussion never
 * stops a change being added, and it is what holds a shared link to a sane amount of writing.
 */
export async function createProjectTask({ project, projectId, ownerId, addedBy, scope }: CreateOptions, input: ProjectTaskInput): Promise<ProjectTask> {
  const kind: ProjectItemKind = input.kind ?? DEFAULT_PROJECT_ITEM_KIND
  // What this tab needs, asked again here: the schema asks it of a request, this asks it of the item
  const problem = itemProblem(kind, input)
  if (problem) throw new UserFacingError(problem)
  await assertOwnItemAttachments([project.ownerId ?? null, ownerId], input)
  await connectDatabase()
  const inTab = { ...scope, projectId, kind }
  const count = await ClientProjectTaskModel.countDocuments(inTab)
  if (count >= MAX_PROJECT_TASKS) throw new UserFacingError(PROJECT_TASK_MESSAGES.tooManyTasks)
  const last = (await ClientProjectTaskModel.findOne(inTab).sort({ position: -1 }).select({ position: 1 }).lean()) as { position?: number } | null
  /**
   * Where it is filed, on the tabs that have folders. The folder is checked against this project
   * and this tab (`folderForItem`), so an item can never be filed into another project's tree, and
   * anything the browser sends for a tab without folders is ignored rather than stored.
   */
  const folderId = hasFolders(kind) ? await folderForItem(projectId, kind, input.folderId) : null
  const record = await ClientProjectTaskModel.create({
    ownerId,
    clientId: project.clientId,
    projectId,
    ...cleanInput(input, kind),
    kind,
    folderId,
    addedBy,
    position: (last?.position ?? count - 1) + 1,
    // Its name on this tab from now on, whatever happens to the order around it
    number: await nextNumber(projectId, kind),
  })
  return toTask(record.toObject() as unknown as StoredTask)
}

/**
 * Changes one item. Only the fields sent are written, so ticking an item off never has to carry its
 * text, images and voice note back. An image or a voice note taken off here is deleted from storage
 * once the record no longer names it, because nothing else can ever point at it.
 *
 * The filter decides who may change what: an account's own scope, or one project when the write
 * came from that project's shared link. `owners` are whose uploads it may newly name: the project's
 * owner and whoever is writing.
 */
export async function changeProjectTask(
  filter: Record<string, unknown>,
  projectId: string,
  input: Partial<ProjectTaskInput>,
  owners: Owners
): Promise<ProjectTask | null> {
  await connectDatabase()
  const current = (await ClientProjectTaskModel.findOne({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!current) return null

  /**
   * The tab it is on once this change lands. An item **moves between the tabs people write on**, so
   * both ends have to be movable: a change may become an idea, and nothing may become a credential,
   * a link, a document or a backup, each of which needs something a change has not got.
   */
  const was = projectItemKind(current.kind).id
  const moving = input.kind !== undefined && input.kind !== was
  if (moving && !(isMovableItemKind(was) && isMovableItemKind(input.kind))) throw new UserFacingError(PROJECT_TASK_MESSAGES.cannotMoveKind)
  // The item as it would be once this change lands, which is what the tab's own rule is asked about
  const kind = moving ? (input.kind as ProjectItemKind) : was
  const merged: ProjectTaskInput = {
    content: input.content ?? current.content,
    description: input.description ?? current.description ?? "",
    url: input.url ?? current.url ?? "",
    files: input.files ?? (current.files ?? []).map(storedProjectFile),
    images: input.images ?? current.images ?? [],
    voiceNote: input.voiceNote !== undefined ? input.voiceNote : current.voiceNote,
    status: input.status,
    priority: input.priority ?? projectPriority(current.priority).id,
    estimate: input.estimate !== undefined ? input.estimate : storedEstimate(current),
    stage: input.stage ?? (current.stage ? roadmapStage(current.stage).id : undefined),
    isClientVisible: input.isClientVisible ?? current.isClientVisible === true,
  }
  const problem = itemProblem(kind, merged)
  if (problem) throw new UserFacingError(problem)
  await assertOwnItemAttachments(owners, input, {
    images: current.images ?? [],
    files: (current.files ?? []).map(storedProjectFile),
    voiceNote: current.voiceNote,
  })

  const cleaned = cleanInput(merged, kind)
  const changes: Record<string, unknown> = {}
  // The name may change because the file did, so it is written whenever either of them is sent
  if (input.content !== undefined || input.files !== undefined) changes.content = cleaned.content
  if (input.description !== undefined) changes.description = cleaned.description
  if (input.url !== undefined) changes.url = cleaned.url
  if (input.images !== undefined) changes.images = cleaned.images
  if (input.files !== undefined) changes.files = cleaned.files
  if (input.voiceNote !== undefined) changes.voiceNote = cleaned.voiceNote
  if (input.status !== undefined) changes.status = cleaned.status
  if (input.priority !== undefined) changes.priority = cleaned.priority
  // Where a roadmap item has got to, and whether the client may read a note: each its own small write
  if (input.stage !== undefined || moving) changes.stage = cleaned.stage
  if (input.isClientVisible !== undefined || moving) changes.isClientVisible = cleaned.isClientVisible
  /**
   * Signing the work off, or taking the mark off again. It records **when** and nothing else: who
   * signed is not stored, at the owner's request, so an item reads as signed or not signed. A tab
   * that cannot be signed off refuses it rather than storing a mark nothing would ever show.
   */
  if (input.signed !== undefined) {
    if (!projectItemShape(kind).signOff) throw new UserFacingError(PROJECT_TASK_MESSAGES.signFailed)
    changes.signedAt = input.signed ? new Date() : null
  }
  // The estimate is written when it is sent, and whenever the item changes tab, since the tab it
  // lands on decides whether it keeps one at all
  if (input.estimate !== undefined || moving) {
    changes.estimateValue = cleaned.estimateValue
    changes.estimateUnit = cleaned.estimateUnit
  }
  /**
   * Moving it to another tab: it keeps everything it carries and takes **that tab's own next
   * number** and the end of its list, so the tab it joins reads as if it had been added there,
   * while the tab it left simply has one fewer. Its old number is not kept, because two items on
   * one tab sharing a number is the one thing numbering must never do.
   */
  if (moving) {
    changes.kind = kind
    changes.number = await nextNumber(projectId, kind)
    const last = (await ClientProjectTaskModel.findOne({ projectId, kind }).sort({ position: -1 }).select({ position: 1 }).lean()) as {
      position?: number
    } | null
    changes.position = (last?.position ?? -1) + 1
    // Folders belong to one tab, so an item that leaves its tab leaves its folder with it
    changes.folderId = null
  }
  /**
   * Moving it between folders is one field like any other, checked against this project and this
   * tab, so a move can never file an item into another project's tree. A tab without folders takes
   * the top of the tree, which is where its items already are.
   */
  if (input.folderId !== undefined) {
    changes.folderId = hasFolders(kind) ? await folderForItem(projectId, kind, input.folderId) : null
  }

  const record = (await ClientProjectTaskModel.findOneAndUpdate({ ...filter, projectId }, { $set: changes }, { returnDocument: "after", runValidators: true }).lean()) as unknown as StoredTask | null
  if (!record) return null

  // What the item no longer names can go: the record is already saved, so an orphan is the worst case
  const keptImages = new Set(cleaned.images.map((image) => image.assetId))
  const keptFiles = new Set(cleaned.files.map((file) => file.assetId))
  await removeAttachments([
    {
      owners: [current.ownerId ?? null, ...owners],
      images: input.images !== undefined ? (current.images ?? []).filter((image) => !keptImages.has(image.assetId)) : [],
      files: input.files !== undefined ? (current.files ?? []).filter((file) => !keptFiles.has(file.assetId)) : [],
      voiceNote: input.voiceNote !== undefined && current.voiceNote?.assetId !== cleaned.voiceNote?.assetId ? current.voiceNote : null,
    },
  ])
  return toTask(record)
}

/** Removes one item, then its images, its files and its voice note (the record goes first). */
export async function removeProjectTask(filter: Record<string, unknown>, projectId: string, owners: Owners): Promise<boolean> {
  await connectDatabase()
  const record = (await ClientProjectTaskModel.findOneAndDelete({ ...filter, projectId }).lean()) as unknown as StoredTask | null
  if (!record) return false
  await removeAttachments([{ owners: [record.ownerId ?? null, ...owners], images: record.images, files: record.files, voiceNote: record.voiceNote }])
  return true
}

/**
 * Puts one tab's items in the order a drag left them.
 *
 * It writes **only the items it is given**, into the places those items already occupy: their own
 * positions, sorted, handed back out in the new order. That is what lets a tab with folders be
 * dragged inside one folder without disturbing what is filed in the others, and it is why the
 * positions are made distinct first (every row saved before ordering has 0, so without that step
 * there would be nothing to hand back out).
 *
 * An order naming an item that is not on this tab of this project, or that the caller may not
 * reach, changes **nothing at all**: the page is told the list moved on and reads it again, rather
 * than being left with half an order written.
 */
export async function reorderProjectTasks(
  filter: Record<string, unknown>,
  projectId: string,
  kind: ProjectItemKind,
  orderedIds: readonly string[]
): Promise<boolean> {
  await connectDatabase()
  const inTab = { ...filter, projectId, kind }
  const all = (await ClientProjectTaskModel.find(inTab).sort({ position: 1, createdAt: 1, _id: 1 }).select({ position: 1 }).lean()) as unknown as {
    _id: { toString: () => string }
    position?: number
  }[]
  const ids = [...new Set(orderedIds)]
  if (ids.length !== orderedIds.length) return false
  const here = new Map(all.map((record) => [record._id.toString(), record.position ?? 0]))
  if (ids.some((id) => !here.has(id))) return false

  // Every item of the tab gets a place of its own first, so there are real slots to hand out
  const spread = new Set(all.map((record) => record.position ?? 0)).size !== all.length
  if (spread) {
    await ClientProjectTaskModel.bulkWrite(
      all.map((record, index) => ({ updateOne: { filter: { _id: record._id }, update: { $set: { position: index } } } }))
    )
    all.forEach((record, index) => here.set(record._id.toString(), index))
  }

  const slots = ids.map((id) => here.get(id) ?? 0).sort((left, right) => left - right)
  await ClientProjectTaskModel.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id, projectId, kind }, update: { $set: { position: slots[index] } } } }))
  )
  return true
}

/** Puts one tab in order as the signed-in owner. False when the project or an item is out of reach. */
export async function orderProjectTasks(viewer: Viewer, projectId: string, kind: ProjectItemKind, orderedIds: readonly string[]): Promise<boolean> {
  if (!(await projectOrNull(viewer, projectId))) return false
  return reorderProjectTasks(visibleTo(viewer), projectId, kind, orderedIds)
}

/** Adds one item as the signed-in owner. Null when the project is gone or another account's. */
export async function addProjectTask(viewer: Viewer, projectId: string, input: ProjectTaskInput): Promise<ProjectTask | null> {
  const project = await projectOrNull(viewer, projectId)
  if (!project) return null
  return createProjectTask({ project, projectId, ownerId: viewer.id, addedBy: "owner", scope: visibleTo(viewer) }, input)
}

const ownersFor = (viewer: Viewer, project: StoredProject): Owners => [project.ownerId ?? null, viewer.id]

/** Changes one item as the signed-in owner. Null when the item or the project is out of reach. */
export async function updateProjectTask(viewer: Viewer, projectId: string, taskId: string, input: Partial<ProjectTaskInput>): Promise<ProjectTask | null> {
  const filter = visibleById(viewer, taskId)
  const project = filter ? await projectOrNull(viewer, projectId) : null
  if (!filter || !project) return null
  return changeProjectTask(filter, projectId, input, ownersFor(viewer, project))
}

/** Removes one item as the signed-in owner. False when the item or the project is out of reach. */
export async function deleteProjectTask(viewer: Viewer, projectId: string, taskId: string): Promise<boolean> {
  const filter = visibleById(viewer, taskId)
  const project = filter ? await projectOrNull(viewer, projectId) : null
  if (!filter || !project) return false
  return removeProjectTask(filter, projectId, ownersFor(viewer, project))
}

/**
 * Removes every item of the projects named, with their images and voice notes. Used when a project
 * or a whole client goes, so nothing is left pointing at a project that no longer exists.
 */
export async function deleteTasksOfProjects(scope: Record<string, unknown>, projectIds: readonly string[]): Promise<number> {
  if (projectIds.length === 0) return 0
  await connectDatabase()
  const records = (await ClientProjectTaskModel.find({ ...scope, projectId: { $in: [...projectIds] } }).lean()) as unknown as StoredTask[]
  if (records.length === 0) return 0
  const projects = (await ClientProjectModel.find({ _id: { $in: [...new Set(records.map((record) => record.projectId))] } }, { ownerId: 1 }).lean()) as unknown as StoredProject[]
  const projectOwner = new Map(projects.map((project) => [project._id.toString(), project.ownerId ?? null]))
  const { deletedCount } = await ClientProjectTaskModel.deleteMany({ _id: { $in: records.map((record) => new mongoose.Types.ObjectId(record._id.toString())) } })
  await removeAttachments(
    records.map((record) => ({
      owners: [record.ownerId ?? null, projectOwner.get(record.projectId) ?? null],
      images: record.images,
      files: record.files,
      voiceNote: record.voiceNote,
    }))
  )
  return deletedCount ?? 0
}
