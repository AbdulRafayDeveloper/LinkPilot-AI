import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { shiftDate } from "@/lib/taskDates"
import { buildTree, type TreeNode } from "@/lib/taskTree"
import { DailyTask as DailyTaskModel, type IDailyTask } from "@/models/DailyTask"
import { HISTORY_DAYS_PER_PAGE, VISIBLE_DAYS } from "@/constants/dailyTasks"
import { TASK_MAX_DEPTH } from "@/constants/taskAttachments"
import type { DailyTask, DailyTaskDay, DailyTasksPage, NewDailyTask } from "@/types/dailyTasks"
import { storedImagesOf, type TaskImage, type TaskImageView } from "@/types/taskAttachment"
import { copyTaskImages, deleteTaskImages, taskImageLists } from "@/services/taskImages"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Tasks live in the daily_tasks collection. Each task belongs to the account that wrote it: a user
 * sees their own days, an admin sees everyone's.
 *
 * A day is a plain YYYY-MM-DD string from the browser's clock, so every comparison here is
 * string or calendar math and never depends on the server's timezone. The page the user sees
 * first covers today and the six days before it; older days are paged, never loaded at once.
 *
 * **Subtasks** are tasks too, on the same day, naming the task they belong to (`parentTaskId`), three
 * levels at most (TASK_MAX_DEPTH). A day's own tasks are the ones with no parent (every task saved
 * before subtasks existed is one); the list nests the rest inside them, and moving, copying or
 * deleting a task takes everything under it along.
 */
// Only what the list draws
const TASK_FIELDS = "content description image images taskDate isCompleted completedAt parentTaskId"

type StoredTask = Pick<IDailyTask, "content" | "taskDate" | "isCompleted" | "completedAt"> & {
  _id: { toString: () => string }
  description?: string
  image?: TaskImage | null
  images?: TaskImage[]
  parentTaskId?: { toString: () => string } | null
  position?: number
}

// A task of its own, not under another: a task saved before subtasks existed has no field at all, which this also matches
const TOP_LEVEL = { parentTaskId: null }

const toTask = (record: StoredTask, images: TaskImageView[] = []): DailyTask => ({
  id: record._id.toString(),
  content: record.content,
  description: record.description ?? "",
  images,
  image: images[0] ?? null,
  taskDate: record.taskDate,
  isCompleted: record.isCompleted,
  completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  parentTaskId: record.parentTaskId ? record.parentTaskId.toString() : null,
  subtasks: [],
})

/**
 * The same records with their images signed, in one round rather than one per task. An image that
 * cannot be signed is simply left out.
 */
async function toTasks(records: StoredTask[]): Promise<DailyTask[]> {
  const signed = await taskImageLists(records, storedImagesOf)
  return records.map((record) => toTask(record, signed.get(record) ?? []))
}

/** Tasks in list order, their subtasks moved inside them; a subtask whose parent isn't here stands on its own. */
function nest(tasks: DailyTask[]): DailyTask[] {
  const toNested = (node: TreeNode<DailyTask>): DailyTask => ({ ...node.item, subtasks: node.children.map(toNested) })
  return buildTree(tasks, { idOf: (task) => task.id, parentOf: (task) => task.parentTaskId }).map(toNested)
}

/**
 * The oldest day the default view shows: today counts as one of the seven.
 */
export const windowStartFor = (today: string): string => shiftDate(today, -(VISIBLE_DAYS - 1))

// Tasks arrive already sorted (newest day first, then each day in the order its tasks were placed)
function groupByDay(tasks: DailyTask[]): DailyTaskDay[] {
  const days: DailyTaskDay[] = []
  for (const task of tasks) {
    const last = days[days.length - 1]
    if (last?.date === task.taskDate) last.tasks.push(task)
    else days.push({ date: task.taskDate, tasks: [task] })
  }
  return days.map((day) => ({ ...day, tasks: nest(day.tasks) }))
}

// The two day filters the list uses (the recent window, or a named set of older days), inside what the viewer may see
type DayFilter = { taskDate: { $gte: string } } | { taskDate: { $in: string[] } }

const findDays = (viewer: Viewer, filter: DayFilter) =>
  DailyTaskModel.find({ ...filter, ...visibleTo(viewer) }, TASK_FIELDS).sort({ taskDate: -1, position: 1, createdAt: 1, _id: 1 }).lean()

/**
 * One page of the list. Page 1 is the last seven days; later pages are older days, a week of
 * days at a time, so no page loads more than it shows. The page is clamped to what exists, so
 * a page that emptied out (after a cleanup, or in a stale tab) still answers with real days.
 */
export async function listTasks(viewer: Viewer, today: string, page: number): Promise<DailyTasksPage> {
  await connectDatabase()
  const windowStart = windowStartFor(today)
  const olderThanWindow = { taskDate: { $lt: windowStart }, ...visibleTo(viewer) }

  const [olderDays, olderTaskCount, overdueCount] = await Promise.all([
    DailyTaskModel.aggregate<{ _id: null; days: number }>([
      { $match: olderThanWindow },
      { $group: { _id: "$taskDate" } },
      { $count: "days" },
    ]).then((rows) => (rows[0] as unknown as { days: number } | undefined)?.days ?? 0),
    DailyTaskModel.countDocuments(olderThanWindow),
    DailyTaskModel.countDocuments({ isCompleted: false, taskDate: { $lt: today }, ...visibleTo(viewer) }),
  ])

  const pageCount = 1 + Math.ceil(olderDays / HISTORY_DAYS_PER_PAGE)
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)

  let records: StoredTask[]
  if (current === 1) {
    records = (await findDays(viewer, { taskDate: { $gte: windowStart } })) as unknown as StoredTask[]
  } else {
    // The days this page covers, newest first, then only those days' tasks: two queries, never one per day
    const dates = await DailyTaskModel.aggregate<{ _id: string }>([
      { $match: olderThanWindow },
      { $group: { _id: "$taskDate" } },
      { $sort: { _id: -1 } },
      { $skip: (current - 2) * HISTORY_DAYS_PER_PAGE },
      { $limit: HISTORY_DAYS_PER_PAGE },
    ])
    const days = dates.map((row) => row._id)
    records = days.length > 0 ? ((await findDays(viewer, { taskDate: { $in: days } })) as unknown as StoredTask[]) : []
  }

  return {
    days: groupByDay(await toTasks(records)),
    page: current,
    pageCount,
    windowStart,
    overdueCount,
    olderTaskCount,
  }
}

// The position after the last of a set of siblings (a day's own tasks, or one task's subtasks)
async function nextPosition(viewer: Viewer, siblings: Record<string, unknown>): Promise<number> {
  const last = await DailyTaskModel.findOne({ ...siblings, ...visibleTo(viewer) }, { position: 1 }).sort({ position: -1 }).lean()
  return last ? last.position + 1 : 0
}

/** How deep a task sits: 1 for a task of its own, 2 for its subtask, and so on up its parents. */
async function depthOf(viewer: Viewer, record: { parentTaskId?: mongoose.Types.ObjectId | null }): Promise<number> {
  let depth = 1
  let parent = record.parentTaskId ?? null
  // Never more than the limit's worth of reads, whatever the data says
  while (parent && depth <= TASK_MAX_DEPTH) {
    const above = (await DailyTaskModel.findOne({ _id: parent, ...visibleTo(viewer) }, { parentTaskId: 1 }).lean()) as { parentTaskId?: mongoose.Types.ObjectId | null } | null
    depth++
    parent = above?.parentTaskId ?? null
  }
  return depth
}

/** Everything under the given tasks, every level down, inside what the viewer may see. */
async function descendantsOf(viewer: Viewer, ids: mongoose.Types.ObjectId[]): Promise<mongoose.Types.ObjectId[]> {
  const found: mongoose.Types.ObjectId[] = []
  let level = ids
  for (let depth = 1; depth < TASK_MAX_DEPTH + 1 && level.length > 0; depth++) {
    const children = (await DailyTaskModel.find({ parentTaskId: { $in: level }, ...visibleTo(viewer) }, { _id: 1 }).lean()) as { _id: mongoose.Types.ObjectId }[]
    level = children.map((child) => child._id)
    found.push(...level)
  }
  return found
}

export type CreateResult = { tasks: DailyTask[] } | { error: "missing-parent" | "too-deep" }

/**
 * Adds tasks in one write, after the ones already there. With `parentTaskId` they are subtasks of that
 * task, on its day, whatever day the request named; one level deeper than TASK_MAX_DEPTH is refused
 * before anything is written. The caller has already dropped the empty rows.
 */
export async function createTasks(viewer: Viewer, taskDate: string, tasks: NewDailyTask[], parentTaskId: string | null = null): Promise<CreateResult> {
  await connectDatabase()
  let day = taskDate
  let parent: mongoose.Types.ObjectId | null = null
  if (parentTaskId) {
    const filter = visibleById(viewer, parentTaskId)
    const record = filter ? ((await DailyTaskModel.findOne(filter, { taskDate: 1, parentTaskId: 1 }).lean()) as (StoredTask & { _id: mongoose.Types.ObjectId; parentTaskId?: mongoose.Types.ObjectId | null }) | null) : null
    if (!record) return { error: "missing-parent" }
    if ((await depthOf(viewer, record)) + 1 > TASK_MAX_DEPTH) return { error: "too-deep" }
    day = record.taskDate
    parent = record._id
  }
  const start = await nextPosition(viewer, parent ? { parentTaskId: parent } : { taskDate: day, ...TOP_LEVEL })
  const records = await DailyTaskModel.insertMany(
    tasks.map((task, index) => ({
      ownerId: viewer.id,
      content: task.content,
      description: task.description,
      image: null,
      images: task.images,
      parentTaskId: parent,
      taskDate: day,
      position: start + index,
      isCompleted: false,
      completedAt: null,
    })),
    { ordered: true }
  )
  return { tasks: await toTasks(records as unknown as StoredTask[]) }
}

/**
 * Ticks one task off, or reopens it. Returns null when that task is gone, so the page can say so
 * instead of showing a state the database doesn't have. A subtask is ticked on its own, as is its parent.
 */
export async function setTaskCompletion(viewer: Viewer, id: string, isCompleted: boolean): Promise<DailyTask | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = await DailyTaskModel.findOneAndUpdate(
    filter,
    { $set: { isCompleted, completedAt: isCompleted ? new Date() : null } },
    { new: true, projection: TASK_FIELDS, lean: true }
  )
  return record ? (await toTasks([record as unknown as StoredTask]))[0] : null
}

/**
 * Changes a task already written: its description, its images and, when sent, its own line. Returns
 * null when that task is gone or belongs to another account.
 *
 * An image that is replaced or taken off goes from storage only after the task is saved without
 * it, never before, so the task can never point at an image that is already gone; a storage
 * failure there is logged and swallowed (`deleteTaskImages`), because the change the user asked
 * for has already been made and the worst case is an object nothing points at. A task saved with one
 * `image` moves it into `images` on its first save.
 */
export async function setTaskDetails(
  viewer: Viewer,
  id: string,
  details: { description: string; images: TaskImage[]; content?: string }
): Promise<DailyTask | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  // The images it carries now, read first so the ones this change drops can be cleared from storage
  const before = (await DailyTaskModel.findOne(filter, "image images").lean()) as unknown as Pick<StoredTask, "image" | "images"> | null
  if (!before) return null
  const changes: Record<string, unknown> = { description: details.description, images: details.images, image: null }
  if (details.content !== undefined) changes.content = details.content
  const record = await DailyTaskModel.findOneAndUpdate(filter, { $set: changes }, { returnDocument: "after", projection: TASK_FIELDS, lean: true })
  if (!record) return null
  const kept = new Set(details.images.map((image) => image.assetId))
  await deleteTaskImages(storedImagesOf(before).filter((image) => !kept.has(image.assetId)))
  return (await toTasks([record as unknown as StoredTask]))[0]
}

/**
 * A task's own line and the lines of the tasks above it, the top one first, for writing its details
 * with AI in context. Null when the task is gone or belongs to another account.
 */
export async function taskLineage(viewer: Viewer, id: string): Promise<{ title: string; parents: string[]; description: string } | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  type Line = { content: string; description?: string; parentTaskId?: mongoose.Types.ObjectId | null }
  const record = (await DailyTaskModel.findOne(filter, { content: 1, description: 1, parentTaskId: 1 }).lean()) as Line | null
  if (!record) return null
  const parents: string[] = []
  let parent = record.parentTaskId ?? null
  while (parent && parents.length < TASK_MAX_DEPTH - 1) {
    const above = (await DailyTaskModel.findOne({ _id: parent, ...visibleTo(viewer) }, { content: 1, parentTaskId: 1 }).lean()) as Line | null
    if (!above) break
    parents.unshift(above.content)
    parent = above.parentTaskId ?? null
  }
  return { title: record.content, parents, description: record.description ?? "" }
}

export type MoveResult = { task: DailyTask } | { error: "missing" | "stale-order" }

/**
 * Puts tasks on a day (their own or another) at a place in that day. `orderedIds` is the day's
 * whole new order of its own tasks, exactly as the page shows it after the drop, so **the order
 * itself says what moved**: every id in it that is on another day now is a task arriving on this one.
 * That is one task for an ordinary drag and the whole selection when several were dragged together,
 * with no difference to the request, and `id` is the task that was dragged. A task's subtasks go
 * with it, and a subtask is never moved on its own (it isn't one of a day's own tasks).
 *
 * The order is checked against the database first: every id must be a day's own task the viewer may
 * see, and none of that day's own tasks may be missing from it. A page that has fallen behind (a task
 * added, moved or deleted in another tab) is refused rather than guessed at. The arrivals and the
 * day's new positions are then written in one ordered bulk write, so the day never shows a moved task
 * with an old position, and a repeat of the same move lands on the same order.
 */
export async function moveTask(viewer: Viewer, id: string, taskDate: string, orderedIds: string[]): Promise<MoveResult> {
  const filter = visibleById(viewer, id)
  if (!filter) return { error: "missing" }
  if (!orderedIds.includes(id)) return { error: "stale-order" }
  await connectDatabase()
  if (!(await DailyTaskModel.exists(filter))) return { error: "missing" }

  // Every task named, with the day it is on now; one that is gone, another account's, or a subtask is missing here
  const named = (await DailyTaskModel.find({ _id: { $in: orderedIds }, ...TOP_LEVEL, ...visibleTo(viewer) }, { _id: 1, taskDate: 1 }).lean()) as unknown as {
    _id: mongoose.Types.ObjectId
    taskDate: string
  }[]
  if (named.length !== orderedIds.length) return { error: "stale-order" }
  const namedIds = new Set(orderedIds)
  const dayNow = await DailyTaskModel.find({ taskDate, ...TOP_LEVEL, ...visibleTo(viewer) }, { _id: 1 }).lean()
  if (dayNow.some((record) => !namedIds.has(String(record._id)))) return { error: "stale-order" }

  const arriving = named.filter((record) => record.taskDate !== taskDate).map((record) => record._id)
  // A task that moves day takes its subtasks with it, since a subtask always sits on its task's day
  const carried = arriving.length > 0 ? [...arriving, ...(await descendantsOf(viewer, arriving))] : []

  await DailyTaskModel.bulkWrite(
    [
      ...(carried.length > 0 ? [{ updateMany: { filter: { _id: { $in: carried }, ...visibleTo(viewer) }, update: { $set: { taskDate } } } }] : []),
      ...orderedIds.map((entry, position) => ({
        updateOne: { filter: { _id: entry, taskDate, ...visibleTo(viewer) }, update: { $set: { position } } },
      })),
    ],
    { ordered: true }
  )

  const record = await DailyTaskModel.findOne(filter, TASK_FIELDS).lean()
  return record ? { task: (await toTasks([record as unknown as StoredTask]))[0] } : { error: "missing" }
}

/**
 * A copy of a task and everything under it: the same line, description, images (copied, so each
 * task keeps its own) and subtasks in the same shape, placed straight after the original, under the
 * same parent on the same day. The copy starts open: ticks are the work done on the original, not
 * part of what is copied. Returns null when the task is gone or belongs to another account.
 */
export async function copyTask(viewer: Viewer, id: string): Promise<DailyTask | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const root = (await DailyTaskModel.findOne(filter).lean()) as unknown as (StoredTask & { _id: mongoose.Types.ObjectId; parentTaskId?: mongoose.Types.ObjectId | null; position: number }) | null
  if (!root) return null
  const below = await descendantsOf(viewer, [root._id])
  const others = below.length > 0 ? ((await DailyTaskModel.find({ _id: { $in: below }, ...visibleTo(viewer) }).sort({ position: 1, createdAt: 1, _id: 1 }).lean()) as unknown as typeof root[]) : []
  const originals = [root, ...others]

  const newIds = new Map(originals.map((record) => [record._id.toString(), new mongoose.Types.ObjectId()]))
  const images = await Promise.all(originals.map((record) => copyTaskImages(storedImagesOf(record))))
  const copies = originals.map((record, index) => ({
    _id: newIds.get(record._id.toString()),
    ownerId: viewer.id,
    content: record.content,
    description: record.description ?? "",
    image: null,
    images: images[index],
    // The copy has the original's parent; each copied subtask has the copy of its own parent
    parentTaskId: index === 0 ? (root.parentTaskId ?? null) : (newIds.get(String(record.parentTaskId)) ?? null),
    taskDate: root.taskDate,
    // Straight after the original, ahead of the next sibling, until the day is next reordered
    position: index === 0 ? root.position + 0.5 : record.position,
    isCompleted: false,
    completedAt: null,
  }))
  await DailyTaskModel.insertMany(copies, { ordered: true })
  const stored = (await DailyTaskModel.find({ _id: { $in: [...newIds.values()] } }, TASK_FIELDS).sort({ position: 1, createdAt: 1, _id: 1 }).lean()) as unknown as StoredTask[]
  // The copy first, then its subtasks nested inside it
  const nested = nest(await toTasks(stored))
  return nested.find((task) => task.id === newIds.get(root._id.toString())?.toString()) ?? null
}

/**
 * The images of the tasks a filter matches, read before those tasks go.
 *
 * Every path that removes a task goes through this: one task, the picked tasks, and the week-old
 * cleanup. Without it a deleted task would leave its objects in storage with nothing pointing at
 * them. The records are removed first and the objects after, so a storage problem leaves an object
 * nobody can reach rather than a task showing an image that is already gone; `deleteTaskImages`
 * logs that and never fails the delete the user asked for.
 */
async function imagesOf(filter: Record<string, unknown>): Promise<TaskImage[]> {
  const records = (await DailyTaskModel.find(filter, "image images").lean()) as unknown as Pick<StoredTask, "image" | "images">[]
  return records.flatMap(storedImagesOf)
}

/**
 * Deletes one task and everything under it. Returns false when it was already gone, so the page can
 * say so instead of leaving a row that no longer exists.
 */
export async function deleteTask(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const record = (await DailyTaskModel.findOne(filter, { _id: 1 }).lean()) as { _id: mongoose.Types.ObjectId } | null
  if (!record) return false
  const all = { _id: { $in: [record._id, ...(await descendantsOf(viewer, [record._id]))] }, ...visibleTo(viewer) }
  // Read first, so the images can go with the tasks rather than being left in storage
  const images = await imagesOf(all)
  const { deletedCount } = await DailyTaskModel.deleteMany(all)
  if (deletedCount > 0) await deleteTaskImages(images)
  return deletedCount > 0
}

/**
 * Deletes every task the viewer owns that is older than the seven-day window, in one bulk delete.
 * Tasks inside the window, today's included, and other accounts' tasks are untouched. A subtask is
 * always on its task's day, so this never leaves one without its task.
 */
export async function deleteTasksBeforeWindow(viewer: Viewer, today: string): Promise<number> {
  await connectDatabase()
  const filter = { taskDate: { $lt: windowStartFor(today) }, ...ownedBy(viewer) }
  const images = await imagesOf(filter)
  const { deletedCount } = await DailyTaskModel.deleteMany(filter)
  await deleteTaskImages(images)
  return deletedCount
}

/** Deletes the tasks named by `ids` and everything under them, inside the viewer's own tasks. Answers how many really went. */
export async function deleteTasks(viewer: Viewer, ids: string[]): Promise<number> {
  await connectDatabase()
  const named = ids.map((id) => new mongoose.Types.ObjectId(id))
  const filter = { ...ownedBy(viewer), _id: { $in: [...named, ...(await descendantsOf(viewer, named))] } }
  const images = await imagesOf(filter)
  const { deletedCount } = await DailyTaskModel.deleteMany(filter)
  await deleteTaskImages(images)
  return deletedCount ?? 0
}
