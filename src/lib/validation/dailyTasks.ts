import { z } from "zod"
import { DAILY_TASKS_MESSAGES, ISO_DATE_PATTERN, MAX_TASKS_PER_DAY_ORDER, MAX_TODAY_DRIFT_DAYS } from "@/constants/dailyTasks"
import { PRIORITY_IDS } from "@/constants/priorities"
import { TASK_DOER_IDS } from "@/constants/taskDoers"
import { shiftDate } from "@/lib/taskDates"

/**
 * The dates and orders the Daily Tasks routes accept. Every day is a plain YYYY-MM-DD string from
 * the browser's clock, so it is checked as a calendar day, never as a timestamp.
 */

export const IsoDate = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, DAILY_TASKS_MESSAGES.invalidDate)
  // Rejects a real-looking date that isn't a real day, e.g. 2026-02-31. Zod still runs this when
  // the pattern above failed, so it must cope with text that is no date at all.
  .refine((date) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  }, DAILY_TASKS_MESSAGES.invalidDate)

/**
 * The browser sends the day its own clock is on, so a task lands on the day the user is living
 * in whatever timezone the server runs in. Any timezone is at most a day from UTC, so a "today"
 * further away than that is not a clock difference and is refused.
 */
export const TodaySchema = IsoDate.refine((date) => {
  const utcToday = new Date().toISOString().slice(0, 10)
  return date >= shiftDate(utcToday, -MAX_TODAY_DRIFT_DAYS) && date <= shiftDate(utcToday, MAX_TODAY_DRIFT_DAYS)
}, DAILY_TASKS_MESSAGES.invalidDate)

const TaskId = z.string().regex(/^[0-9a-f]{24}$/, DAILY_TASKS_MESSAGES.invalidOrder)

/**
 * How urgent a task is. It is **optional everywhere**, so a request written before priorities
 * existed is accepted exactly as it was and the task simply takes the default, Medium.
 */
export const PrioritySchema = z.enum(PRIORITY_IDS, { message: DAILY_TASKS_MESSAGES.invalidPriority })

/** Changing only how urgent a task is, which is its own small update like a tick. */
export const TaskPrioritySchema = z.object({ priority: PrioritySchema })

/**
 * Who does the task: me, or an employee. Optional everywhere for the same reason the priority is,
 * so a request written before this takes the default, Me.
 */
export const DoerSchema = z.enum(TASK_DOER_IDS, { message: DAILY_TASKS_MESSAGES.invalidDoer })

/** Changing only who does a task, its own small update like a tick. */
export const TaskDoerSchema = z.object({ doer: DoerSchema })

/** Blocking a task or unblocking it, which is its own small update too. */
export const TaskBlockedSchema = z.object({ isBlocked: z.boolean() })

/** Setting a task to repeat every day, or to stop; its own small update like the rest. */
export const TaskRepeatsSchema = z.object({ repeats: z.boolean() })

/**
 * A task dropped onto a day (its own or another), with that day's whole new order. Moving to a
 * later day than today is refused for the same reason adding to one is: it would never show.
 */
/** The overdue tasks to bring onto today: all of them, or only the ones named. */
export const MoveOverdueSchema = z.object({
  today: TodaySchema,
  ids: z.array(TaskId).min(1, DAILY_TASKS_MESSAGES.invalidTask).max(MAX_TASKS_PER_DAY_ORDER, DAILY_TASKS_MESSAGES.invalidOrder).optional(),
})

export const MoveTaskSchema = z
  .object({
    today: TodaySchema,
    taskDate: IsoDate,
    orderedIds: z.array(TaskId).min(1, DAILY_TASKS_MESSAGES.invalidOrder).max(MAX_TASKS_PER_DAY_ORDER, DAILY_TASKS_MESSAGES.invalidOrder),
  })
  .refine((body) => body.taskDate <= body.today, { message: DAILY_TASKS_MESSAGES.futureDate, path: ["taskDate"] })
  .refine((body) => new Set(body.orderedIds).size === body.orderedIds.length, { message: DAILY_TASKS_MESSAGES.invalidOrder, path: ["orderedIds"] })
