import { connectDatabase } from "@/lib/db"
import { shiftDate } from "@/lib/taskDates"
import { DailyTask as DailyTaskModel, type IDailyTask } from "@/models/DailyTask"
import { HISTORY_DAYS_PER_PAGE, VISIBLE_DAYS } from "@/constants/dailyTasks"
import type { DailyTask, DailyTaskDay, DailyTasksPage } from "@/types/dailyTasks"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Tasks live in the daily_tasks collection. Each task belongs to the account that wrote it: a user
 * sees their own days, an admin sees everyone's.
 *
 * A day is a plain YYYY-MM-DD string from the browser's clock, so every comparison here is
 * string or calendar math and never depends on the server's timezone. The page the user sees
 * first covers today and the six days before it; older days are paged, never loaded at once.
 */
// Only what the list draws
const TASK_FIELDS = "content taskDate isCompleted completedAt"

type StoredTask = Pick<IDailyTask, "content" | "taskDate" | "isCompleted" | "completedAt"> & {
  _id: { toString: () => string }
}

const toTask = (record: StoredTask): DailyTask => ({
  id: record._id.toString(),
  content: record.content,
  taskDate: record.taskDate,
  isCompleted: record.isCompleted,
  completedAt: record.completedAt ? record.completedAt.toISOString() : null,
})

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
  return days
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
    days: groupByDay(records.map(toTask)),
    page: current,
    pageCount,
    windowStart,
    overdueCount,
    olderTaskCount,
  }
}

// The position after the last task of a day, so a new task lands at the end of it
async function nextPosition(viewer: Viewer, taskDate: string): Promise<number> {
  const last = await DailyTaskModel.findOne({ taskDate, ...visibleTo(viewer) }, { position: 1 }).sort({ position: -1 }).lean()
  return last ? last.position + 1 : 0
}

/**
 * Adds a day's tasks in one write, after the tasks the day already has. The caller has already
 * dropped the empty rows.
 */
export async function createTasks(viewer: Viewer, taskDate: string, contents: string[]): Promise<DailyTask[]> {
  await connectDatabase()
  const start = await nextPosition(viewer, taskDate)
  const records = await DailyTaskModel.insertMany(
    contents.map((content, index) => ({ ownerId: viewer.id, content, taskDate, position: start + index, isCompleted: false, completedAt: null })),
    { ordered: true }
  )
  return (records as unknown as StoredTask[]).map(toTask)
}

/**
 * Ticks one task off, or reopens it. Returns null when that task is gone, so the page can say so
 * instead of showing a state the database doesn't have.
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
  return record ? toTask(record as unknown as StoredTask) : null
}

export type MoveResult = { task: DailyTask } | { error: "missing" | "stale-order" }

/**
 * Puts a task on a day (its own or another) at a place in that day. `orderedIds` is the day's
 * whole new order, the moved task included, exactly as the page shows it after the drop.
 *
 * The order is checked against the database first: every other id must be a task the viewer may
 * see that is on that day now, and none of that day's tasks may be missing from it. A page that
 * has fallen behind (a task added or moved in another tab) is refused rather than guessed at.
 * The move and the day's new positions are then written in one ordered bulk write, so the day
 * never shows the moved task with an old position.
 */
export async function moveTask(viewer: Viewer, id: string, taskDate: string, orderedIds: string[]): Promise<MoveResult> {
  const filter = visibleById(viewer, id)
  if (!filter) return { error: "missing" }
  if (!orderedIds.includes(id)) return { error: "stale-order" }
  await connectDatabase()
  if (!(await DailyTaskModel.exists(filter))) return { error: "missing" }

  const others = orderedIds.filter((entry) => entry !== id)
  const dayNow = await DailyTaskModel.find({ taskDate, _id: { $ne: id }, ...visibleTo(viewer) }, { _id: 1 }).lean()
  const dayIds = new Set(dayNow.map((record) => String(record._id)))
  if (dayIds.size !== others.length || others.some((entry) => !dayIds.has(entry))) return { error: "stale-order" }

  await DailyTaskModel.bulkWrite(
    [
      { updateOne: { filter, update: { $set: { taskDate } } } },
      ...orderedIds.map((entry, position) => ({
        updateOne: { filter: { _id: entry, taskDate, ...visibleTo(viewer) }, update: { $set: { position } } },
      })),
    ],
    { ordered: true }
  )

  const record = await DailyTaskModel.findOne(filter, TASK_FIELDS).lean()
  return record ? { task: toTask(record as unknown as StoredTask) } : { error: "missing" }
}

/**
 * Deletes one task. Returns false when it was already gone, so the page can say so instead of
 * leaving a row that no longer exists.
 */
export async function deleteTask(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const { deletedCount } = await DailyTaskModel.deleteOne(filter)
  return deletedCount > 0
}

/**
 * Deletes every task the viewer owns that is older than the seven-day window, in one bulk delete.
 * Tasks inside the window, today's included, and other accounts' tasks are untouched.
 */
export async function deleteTasksBeforeWindow(viewer: Viewer, today: string): Promise<number> {
  await connectDatabase()
  const { deletedCount } = await DailyTaskModel.deleteMany({ taskDate: { $lt: windowStartFor(today) }, ...ownedBy(viewer) })
  return deletedCount
}
