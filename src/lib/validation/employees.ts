import { z } from "zod"
import {
  EMPLOYEE_CITY_MAX_LENGTH,
  EMPLOYEE_MESSAGES,
  EMPLOYEE_NAME_MAX_LENGTH,
  EMPLOYEE_ROLE_MAX_LENGTH,
  EMPLOYEE_STATUS_IDS,
  EMPLOYEES_LIST_MAX,
  PLAN_ITEM_MAX_LENGTH,
  PLAN_MAX_ITEMS,
  PLAN_NOTES_MAX_LENGTH,
  PLAN_REASON_MAX_LENGTH,
  PLAN_TODAY_DRIFT_DAYS,
} from "@/constants/employees"
import { shiftDate } from "@/lib/taskDates"
import { TaskDetailsSchema } from "@/lib/validation/taskAttachment"
import { treeProblem } from "@/lib/taskTree"
import { TASK_ATTACHMENT_MESSAGES, TASK_MAX_DEPTH } from "@/constants/taskAttachments"
import { choiceParam, cursorParam, searchParam } from "./listFilters"

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
// A real calendar day, not just the shape of one (2026-02-31 is refused)
const isCalendarDay = (value: string) => ISO_DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

const text = (missing: string, tooLong: string, max: number) =>
  z
    .string({ error: missing })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, missing).max(max, tooLong))

export const EmployeeSchema = z.object({
  name: text(EMPLOYEE_MESSAGES.missingName, EMPLOYEE_MESSAGES.nameTooLong, EMPLOYEE_NAME_MAX_LENGTH),
  city: text(EMPLOYEE_MESSAGES.missingCity, EMPLOYEE_MESSAGES.cityTooLong, EMPLOYEE_CITY_MAX_LENGTH),
  role: text(EMPLOYEE_MESSAGES.missingRole, EMPLOYEE_MESSAGES.roleTooLong, EMPLOYEE_ROLE_MAX_LENGTH),
  joiningDate: z
    .string({ error: EMPLOYEE_MESSAGES.badJoiningDate })
    .refine(isCalendarDay, EMPLOYEE_MESSAGES.badJoiningDate)
    // Someone starting next month can be added now; a date years away is a typo
    .refine((value) => value <= shiftDate(new Date().toISOString().slice(0, 10), 366), EMPLOYEE_MESSAGES.futureJoiningDate),
  status: z.enum(EMPLOYEE_STATUS_IDS, { error: EMPLOYEE_MESSAGES.badStatus }),
})

// The team in its new order after a drag: every employee the page shows, top to bottom, each once
export const EmployeeOrderSchema = z.object({
  orderedIds: z
    .array(z.string().regex(/^[0-9a-f]{24}$/, EMPLOYEE_MESSAGES.teamOrderChanged))
    .min(1, EMPLOYEE_MESSAGES.teamOrderChanged)
    .max(EMPLOYEES_LIST_MAX, EMPLOYEE_MESSAGES.teamOrderChanged)
    .refine((ids) => new Set(ids).size === ids.length, EMPLOYEE_MESSAGES.teamOrderChanged),
})

export const EmployeesQuerySchema = z.object({
  cursor: cursorParam,
  search: searchParam,
  status: choiceParam(EMPLOYEE_STATUS_IDS),
})

const Day = z.string({ error: EMPLOYEE_MESSAGES.badPlanDate }).refine(isCalendarDay, EMPLOYEE_MESSAGES.badPlanDate)

// A task's id, made by the page that added it
const ItemId = z.string().regex(/^[\w-]{1,40}$/, EMPLOYEE_MESSAGES.itemNotFound)

/**
 * The day an employee's own browser is on. Any timezone is at most a day from UTC, so a "today"
 * further away than that is a wrong clock, and today's plan can't be changed from it.
 */
export const TodaySchema = z
  .string({ error: EMPLOYEE_MESSAGES.badToday })
  .refine(isCalendarDay, EMPLOYEE_MESSAGES.badToday)
  .refine((date) => {
    const utcToday = new Date().toISOString().slice(0, 10)
    return date >= shiftDate(utcToday, -PLAN_TODAY_DRIFT_DAYS) && date <= shiftDate(utcToday, PLAN_TODAY_DRIFT_DAYS)
  }, EMPLOYEE_MESSAGES.badToday)

// Every plan call names the day the browser is on: the plan repeats, and ticks belong to a day
export const PlanQuerySchema = z.object({ today: TodaySchema })

export const PlanSchema = z.object({
  today: TodaySchema,
  items: z
    .array(
      z
        .object({
          id: ItemId,
          text: z.string().trim().max(PLAN_ITEM_MAX_LENGTH, EMPLOYEE_MESSAGES.itemTooLong),
          // The task this one is a subtask of, by id; left out, it is a task of its own, as before
          parentId: ItemId.nullish().transform((value) => value ?? null),
        })
        // The same optional detail a Daily Task carries, checked the same way
        .and(TaskDetailsSchema)
    )
    .max(PLAN_MAX_ITEMS, EMPLOYEE_MESSAGES.tooManyItems)
    // Every parent is one of these tasks, nothing loops, and nothing sits deeper than three levels
    .superRefine((items, context) => {
      const problem = treeProblem(items, { idOf: (item) => item.id, parentOf: (item) => item.parentId }, TASK_MAX_DEPTH)
      if (problem) context.addIssue({ code: "custom", message: problem === "too-deep" ? TASK_ATTACHMENT_MESSAGES.tooDeep : TASK_ATTACHMENT_MESSAGES.missingParent })
    }),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH, EMPLOYEE_MESSAGES.notesTooLong),
})

/**
 * Ticks or unticks a task, from the manager's page or the employee's link. Without a `date` it is
 * the day being worked on; with one it is that day in the history, which stays tickable so a task
 * finished late can still be ticked off.
 */
export const TickSchema = z.object({ today: TodaySchema, date: Day.optional(), itemId: ItemId, done: z.boolean() })

/**
 * Why a task wasn't finished, written by the employee on their link, for the day they are on or for
 * a day in their history. An empty reason removes the one that was there.
 */
export const ReasonSchema = z.object({
  today: TodaySchema,
  date: Day.optional(),
  itemId: ItemId,
  reason: z.string().trim().max(PLAN_REASON_MAX_LENGTH, EMPLOYEE_MESSAGES.reasonTooLong),
})

/**
 * What the employee's link does to their day: clear today's ticks, finish this day and open the
 * next one, or cancel this day and go back to the day before it. Only "start-new-day" moves the day
 * on, so nothing rolls over at midnight by itself, and only "cancel-day" moves it back.
 */
export const DayActionSchema = z.object({
  today: TodaySchema,
  action: z.enum(["reset", "start-new-day", "cancel-day"]).default("reset"),
})

/** A new order for the plan's tasks: the same tasks, each once, nothing added or left out. */
export const OrderSchema = z.object({
  today: TodaySchema,
  order: z
    .array(ItemId)
    .max(PLAN_MAX_ITEMS, EMPLOYEE_MESSAGES.tooManyItems)
    .refine((ids) => new Set(ids).size === ids.length, EMPLOYEE_MESSAGES.orderChanged),
})

// The history reads the days before this one
export const HistoryQuerySchema = z.object({ before: Day })

export const PlanLinkSchema = z.object({ action: z.enum(["create", "replace", "disable"]) })
