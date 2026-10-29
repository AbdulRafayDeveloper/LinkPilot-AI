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

/**
 * A drag made on a narrowed list, put into the **whole** list it was made on. Only part of a day (or
 * of a task's subtasks) is on screen while a filter is on, but the server is always sent the whole
 * order, so the tasks that are hidden keep exactly the places they had and only what was moved goes
 * somewhere new: just above the shown task that now follows it, or just below the one that comes
 * before it, or at the end when nothing shown is beside it.
 *
 * `full` is the whole order before the drag (it may still contain the moved ids, which are taken
 * out), `shown` the new order of what was on screen, `moved` what travelled.
 */
export function mergeShownOrder(full: string[], shown: string[], moved: ReadonlySet<string>): string[] {
  const rest = full.filter((id) => !moved.has(id))
  const block = shown.filter((id) => moved.has(id))
  if (block.length === 0) return rest
  const first = shown.findIndex((id) => moved.has(id))
  const last = shown.length - 1 - [...shown].reverse().findIndex((id) => moved.has(id))
  const next = shown.slice(last + 1).find((id) => !moved.has(id) && rest.includes(id))
  if (next) {
    const at = rest.indexOf(next)
    return [...rest.slice(0, at), ...block, ...rest.slice(at)]
  }
  const previous = shown.slice(0, first).reverse().find((id) => !moved.has(id) && rest.includes(id))
  if (previous) {
    const at = rest.indexOf(previous) + 1
    return [...rest.slice(0, at), ...block, ...rest.slice(at)]
  }
  return [...rest, ...block]
}

/**
 * Which one item a reorder moved, read from the order before and after it (a subtask list moves one
 * at a time). Null when nothing moved.
 */
export function movedItem(before: string[], after: string[]): string | null {
  if (before.length !== after.length || before.every((id, index) => id === after[index])) return null
  const without = (list: string[], id: string) => list.filter((entry) => entry !== id)
  return after.find((id) => without(before, id).join("\n") === without(after, id).join("\n")) ?? null
}
