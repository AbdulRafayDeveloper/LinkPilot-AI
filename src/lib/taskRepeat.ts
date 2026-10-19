/**
 * How often a daily task comes back: not at all, every day, every week or every month.
 *
 * A repeating task is not copied and is not scheduled: it is **the one task moving forward** when
 * the overdue button is pressed, finished or not, and arriving unticked. What the interval decides
 * is **which day it is allowed to move on**, at the owner's request: a weekly task comes back on a
 * Monday and a monthly one on the 1st, so a week's work is not dragged forward every morning.
 *
 * A day is a plain YYYY-MM-DD string from the browser's clock, as everywhere else in Daily Tasks,
 * so the reading here is string and calendar work and never depends on the server's timezone.
 */
export const TASK_REPEATS = [
  { id: "daily", label: "Daily", due: "every day" },
  { id: "weekly", label: "Weekly", due: "on a Monday" },
  { id: "monthly", label: "Monthly", due: "on the 1st" },
] as const

export type RepeatKind = (typeof TASK_REPEATS)[number]["id"]
/** "none" is a task that happens once, which is what nearly every task is. */
export type TaskRepeat = "none" | RepeatKind

export const TASK_REPEAT_IDS = ["none", ...TASK_REPEATS.map((kind) => kind.id)] as [TaskRepeat, ...TaskRepeat[]]

export const NO_REPEAT: TaskRepeat = "none"

/** What a task comes back as when its interval is turned on from the row's own control. */
export const FIRST_REPEAT: RepeatKind = "daily"

/**
 * How often a task repeats, read safely. Anything unknown is "once", so a task saved before this
 * existed is never a special case; `repeats: true` is how the first version of this wrote "daily",
 * and is still read as that.
 */
export const repeatOf = (value: unknown, wasRepeating?: unknown): TaskRepeat => {
  if (typeof value === "string" && (TASK_REPEAT_IDS as readonly string[]).includes(value)) return value as TaskRepeat
  return wasRepeating === true ? "daily" : NO_REPEAT
}

export const repeatWords = (repeat: TaskRepeat) => TASK_REPEATS.find((kind) => kind.id === repeat) ?? null

/**
 * Whether a repeating task may come back on this day.
 *
 * Monday is day 1 and the 1st is the first of the month, both read from the day itself rather than
 * from a clock, so the same string always gives the same answer wherever it is read.
 */
export function isRepeatDue(repeat: TaskRepeat, today: string): boolean {
  switch (repeat) {
    case "daily":
      return true
    case "weekly": {
      const when = Date.parse(`${today}T00:00:00Z`)
      return !Number.isNaN(when) && new Date(when).getUTCDay() === 1
    }
    case "monthly":
      return today.slice(8, 10) === "01"
    case "none":
      return false
  }
}

/** The intervals that may come back on this day, for the one query that counts them. */
export const repeatsDueOn = (today: string): RepeatKind[] => TASK_REPEATS.map((kind) => kind.id).filter((kind) => isRepeatDue(kind, today))
