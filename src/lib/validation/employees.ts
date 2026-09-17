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
  PLAN_TODAY_DRIFT_DAYS,
} from "@/constants/employees"
import { shiftDate } from "@/lib/taskDates"
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
      z.object({
        id: ItemId,
        text: z.string().trim().max(PLAN_ITEM_MAX_LENGTH, EMPLOYEE_MESSAGES.itemTooLong),
      })
    )
    .max(PLAN_MAX_ITEMS, EMPLOYEE_MESSAGES.tooManyItems),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH, EMPLOYEE_MESSAGES.notesTooLong),
})

/** Ticks or unticks one of today's tasks, from the manager's page or the employee's link. */
export const TickSchema = z.object({ today: TodaySchema, itemId: ItemId, done: z.boolean() })
export const ResetSchema = z.object({ today: TodaySchema })

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
