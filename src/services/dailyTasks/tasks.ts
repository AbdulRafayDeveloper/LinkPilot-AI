import mongoose from "mongoose"

import { connectDatabase } from "@/lib/db"
import { shiftDate } from "@/lib/taskDates"
import { DailyTask as DailyTaskModel, type IDailyTask } from "@/models/DailyTask"
import { HISTORY_DAYS_PER_PAGE, VISIBLE_DAYS } from "@/constants/dailyTasks"
import type { DailyTask, DailyTaskDay, DailyTasksPage } from "@/types/dailyTasks"

/**
 * Tasks live in the daily_tasks collection. The app has no accounts, so they belong to whoever
 * opens it, exactly like Quick Notes and the saved Trending searches.
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

// Tasks arrive already sorted (newest day first, oldest task first within a day)
function groupByDay(tasks: DailyTask[]): DailyTaskDay[] {
  const days: DailyTaskDay[] = []
  for (const task of tasks) {
    const last = days[days.length - 1]
    if (last?.date === task.taskDate) last.tasks.push(task)
    else days.push({ date: task.taskDate, tasks: [task] })
  }
  return days
}

// The two day filters the list uses: the recent window, or a named set of older days
type DayFilter = { taskDate: { $gte: string } } | { taskDate: { $in: string[] } }

const findDays = (filter: DayFilter) =>
  DailyTaskModel.find(filter, TASK_FIELDS).sort({ taskDate: -1, createdAt: 1, _id: 1 }).lean()

/**
 * One page of the list. Page 1 is the last seven days; later pages are older days, a week of
 * days at a time, so no page loads more than it shows. The page is clamped to what exists, so
 * a page that emptied out (after a cleanup, or in a stale tab) still answers with real days.
 */
export async function listTasks(today: string, page: number): Promise<DailyTasksPage> {
  await connectDatabase()
  const windowStart = windowStartFor(today)
  const olderThanWindow = { taskDate: { $lt: windowStart } }

  const [olderDays, olderTaskCount, overdueCount] = await Promise.all([
    DailyTaskModel.aggregate<{ _id: null; days: number }>([
      { $match: olderThanWindow },
      { $group: { _id: "$taskDate" } },
      { $count: "days" },
    ]).then((rows) => (rows[0] as unknown as { days: number } | undefined)?.days ?? 0),
    DailyTaskModel.countDocuments(olderThanWindow),
    DailyTaskModel.countDocuments({ isCompleted: false, taskDate: { $lt: today } }),
  ])

  const pageCount = 1 + Math.ceil(olderDays / HISTORY_DAYS_PER_PAGE)
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)

  let records: StoredTask[]
  if (current === 1) {
    records = (await findDays({ taskDate: { $gte: windowStart } })) as unknown as StoredTask[]
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
    records = days.length > 0 ? ((await findDays({ taskDate: { $in: days } })) as unknown as StoredTask[]) : []
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

/**
 * Adds a day's tasks in one write. The caller has already dropped the empty rows.
 */
export async function createTasks(taskDate: string, contents: string[]): Promise<DailyTask[]> {
  await connectDatabase()
  const records = await DailyTaskModel.insertMany(
    contents.map((content) => ({ content, taskDate, isCompleted: false, completedAt: null })),
    { ordered: true }
  )
  return (records as unknown as StoredTask[]).map(toTask)
}

/**
 * Ticks one task off, or reopens it. Returns null when that task is gone, so the page can say so
 * instead of showing a state the database doesn't have.
 */
export async function setTaskCompletion(id: string, isCompleted: boolean): Promise<DailyTask | null> {
  if (!mongoose.isValidObjectId(id)) return null
  await connectDatabase()
  const record = await DailyTaskModel.findByIdAndUpdate(
    id,
    { $set: { isCompleted, completedAt: isCompleted ? new Date() : null } },
    { new: true, projection: TASK_FIELDS, lean: true }
  )
  return record ? toTask(record as unknown as StoredTask) : null
}

/**
 * Deletes one task. Returns false when it was already gone, so the page can say so instead of
 * leaving a row that no longer exists.
 */
export async function deleteTask(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false
  await connectDatabase()
  const { deletedCount } = await DailyTaskModel.deleteOne({ _id: id })
  return deletedCount > 0
}

/**
 * Deletes every task older than the seven-day window in one bulk delete. Tasks inside the
 * window, today's included, are untouched.
 */
export async function deleteTasksBeforeWindow(today: string): Promise<number> {
  await connectDatabase()
  const { deletedCount } = await DailyTaskModel.deleteMany({ taskDate: { $lt: windowStartFor(today) } })
  return deletedCount
}
