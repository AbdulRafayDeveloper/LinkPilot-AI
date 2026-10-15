import type { Priority } from "@/constants/priorities"
import type { DailyTask, DailyTaskDay } from "@/types/dailyTasks"

/**
 * The days with only the tasks of one priority left in them.
 *
 * Two rules, and both are about keeping what is left readable:
 *   - a task whose **own** priority matches is kept whole, with every subtask under it, because that
 *     task is what was asked for and its subtasks are part of it;
 *   - a task that does not match is still kept when **something under it does**, with only the
 *     matching subtasks, so a High subtask is never shown with no line saying what it belongs to.
 * A day with nothing left is dropped rather than shown empty, so a filter never turns the list into
 * a column of empty days.
 *
 * It is pure and lives here rather than in the list, so the rule can be read and tested on its own
 * (`tests/taskFilters.test.mjs`).
 */

const keep = (task: DailyTask, priority: Priority): DailyTask | null => {
  if (task.priority === priority) return task
  const subtasks = task.subtasks.map((subtask) => keep(subtask, priority)).filter((subtask): subtask is DailyTask => subtask !== null)
  return subtasks.length > 0 ? { ...task, subtasks } : null
}

export function onlyPriority(days: DailyTaskDay[], priority: Priority | ""): DailyTaskDay[] {
  if (!priority) return days
  return days
    .map((day) => ({ ...day, tasks: day.tasks.map((task) => keep(task, priority)).filter((task): task is DailyTask => task !== null) }))
    .filter((day) => day.tasks.length > 0)
}

/** How many tasks a filtered view is showing, subtasks included, for the line that says so. */
export const countTasks = (days: DailyTaskDay[]): number => {
  const count = (tasks: DailyTask[]): number => tasks.reduce((total, task) => total + 1 + count(task.subtasks), 0)
  return days.reduce((total, day) => total + count(day.tasks), 0)
}
