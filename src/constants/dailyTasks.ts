import { ListTodo, type LucideIcon } from "lucide-react"

/**
 * Daily Tasks: a short checklist per day. A task is only its text and the day it belongs to,
 * so the limits here are what one task may hold, how many can be written at once, and how far
 * back the list reaches before older days move to their own pages.
 */
// One task is a line, not a document
export const TASK_MAX_LENGTH = 300
// Rows the composer offers at once; a bulk paste is cut to this many
export const MAX_TASKS_PER_SUBMIT = 25
// Rows the composer starts with
export const INITIAL_TASK_ROWS = 3
// The default view: today and the six days before it
export const VISIBLE_DAYS = 7
// Older days, oldest pages last, this many days to a page
export const HISTORY_DAYS_PER_PAGE = 7

// A calendar day, as the browser's own clock sees it
export const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
// How far a browser's "today" may sit from the server's UTC day before it looks wrong (any timezone is ±1)
export const MAX_TODAY_DRIFT_DAYS = 1
// The most tasks one day's new order may list when a task is dropped into it
export const MAX_TASKS_PER_DAY_ORDER = 500

export const DAILY_TASKS_ENDPOINT = "/api/daily-tasks"

export const DAILY_TASKS_MESSAGES = {
  missingContent: "Write at least one task.",
  contentTooLong: `A task must be under ${TASK_MAX_LENGTH} characters.`,
  tooManyTasks: `You can add ${MAX_TASKS_PER_SUBMIT} tasks at a time.`,
  invalidDate: "Pick a valid task date.",
  futureDate: "Tasks can be added for today or an earlier day.",
  invalidTask: "That task no longer exists.",
  saved: "Tasks added.",
  saveFailed: "Couldn't add the tasks. Please try again.",
  loadFailed: "Couldn't load your tasks.",
  updateFailed: "Couldn't update that task. Please try again.",
  taskDeleted: "Task deleted.",
  deleteFailed: "Couldn't delete that task. Please try again.",
  moveFailed: "Couldn't move that task, so it is back where it was. Please try again.",
  invalidOrder: "That new order doesn't match the tasks on that day. Reload and try again.",
  addToDayFailed: "Couldn't add that task. Please try again.",
  cleanupFailed: "Couldn't delete the older tasks. Please try again.",
  cleaned: "Older tasks deleted.",
  nothingToClean: "There was nothing older than a week to delete.",
  empty: "No tasks for the last seven days yet. Add today's tasks on the left.",
  emptyHistory: "No tasks on these days.",
} as const

// The module's sidebar entry, listed with the other non-LinkedIn modules
export const DAILY_TASKS_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "daily-tasks",
  title: "Daily Tasks",
  description: "Today's checklist, seven-day view",
  icon: ListTodo,
  href: "/daily-tasks",
  group: "workspace",
}
