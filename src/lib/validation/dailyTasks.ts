import { z } from "zod"
import { DAILY_TASKS_MESSAGES, ISO_DATE_PATTERN, MAX_TASKS_PER_DAY_ORDER, MAX_TODAY_DRIFT_DAYS } from "@/constants/dailyTasks"
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
 * A task dropped onto a day (its own or another), with that day's whole new order. Moving to a
 * later day than today is refused for the same reason adding to one is: it would never show.
 */
export const MoveTaskSchema = z
  .object({
    today: TodaySchema,
    taskDate: IsoDate,
    orderedIds: z.array(TaskId).min(1, DAILY_TASKS_MESSAGES.invalidOrder).max(MAX_TASKS_PER_DAY_ORDER, DAILY_TASKS_MESSAGES.invalidOrder),
  })
  .refine((body) => body.taskDate <= body.today, { message: DAILY_TASKS_MESSAGES.futureDate, path: ["taskDate"] })
  .refine((body) => new Set(body.orderedIds).size === body.orderedIds.length, { message: DAILY_TASKS_MESSAGES.invalidOrder, path: ["orderedIds"] })
