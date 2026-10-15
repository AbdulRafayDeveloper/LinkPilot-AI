import type { Priority } from "@/constants/priorities"
import type { TaskDoer } from "@/constants/taskDoers"
import type { DailyTask, DailyTaskDay } from "@/types/dailyTasks"

/**
 * The days with only the tasks that match what the list is narrowed to: one priority, one person
 * doing them, blocked or not, done or not, or **any combination of those at once**. Each is "" when
 * it is not being narrowed on, so nothing chosen means every task.
 *
 * Two rules, and both are about keeping what is left readable:
 *   - a task that matches **itself** is kept whole, with every subtask under it, because that task
 *     is what was asked for and its subtasks are part of it;
 *   - a task that does not match is still kept when **something under it does**, with only the
 *     matching subtasks, so a High subtask is never shown with no line saying what it belongs to.
 * A day with nothing left is dropped rather than shown empty, so a filter never turns the list into
 * a column of empty days.
 *
 * It is pure and lives here rather than in the list, so the rule can be read and tested on its own
 * (`tests/taskFilters.test.mjs`).
 */

/** A yes-or-no narrowing: "" is not narrowing on it at all. */
export type YesOrNo = "" | "yes" | "no"

export interface TaskNarrowing {
  priority: Priority | ""
  doer: TaskDoer | ""
  // Whether something else is holding the task up
  blocked: YesOrNo
  // Whether it is ticked off
  done: YesOrNo
}

export const NOTHING_NARROWED: TaskNarrowing = { priority: "", doer: "", blocked: "", done: "" }

/** Whether the list is being narrowed at all, which is also what turns dragging off. */
export const isNarrowed = (narrowing: TaskNarrowing): boolean => Object.values(narrowing).some((value) => value !== "")

const agrees = (want: YesOrNo, is: boolean): boolean => want === "" || (want === "yes") === is

// Every narrowing that is on has to agree, so several at once mean the task matches all of them
const fits = (task: DailyTask, narrowing: TaskNarrowing): boolean =>
  (narrowing.priority === "" || task.priority === narrowing.priority) &&
  (narrowing.doer === "" || task.doer === narrowing.doer) &&
  agrees(narrowing.blocked, task.isBlocked) &&
  agrees(narrowing.done, task.isCompleted)

const keep = (task: DailyTask, narrowing: TaskNarrowing): DailyTask | null => {
  if (fits(task, narrowing)) return task
  const subtasks = task.subtasks.map((subtask) => keep(subtask, narrowing)).filter((subtask): subtask is DailyTask => subtask !== null)
  return subtasks.length > 0 ? { ...task, subtasks } : null
}

export function narrowDays(days: DailyTaskDay[], narrowing: TaskNarrowing): DailyTaskDay[] {
  if (!isNarrowed(narrowing)) return days
  return days
    .map((day) => ({ ...day, tasks: day.tasks.map((task) => keep(task, narrowing)).filter((task): task is DailyTask => task !== null) }))
    .filter((day) => day.tasks.length > 0)
}

/** How many tasks a narrowed view is showing, subtasks included, for the line that says so. */
export const countTasks = (days: DailyTaskDay[]): number => {
  const count = (tasks: DailyTask[]): number => tasks.reduce((total, task) => total + 1 + count(task.subtasks), 0)
  return days.reduce((total, day) => total + count(day.tasks), 0)
}
