import { ListTodo, type LucideIcon } from "lucide-react"
import { TEXT_BOX_MAX_LENGTH } from "./textLimits"

/**
 * Daily Tasks: a short checklist per day. A task is only its text and the day it belongs to,
 * so the limits here are what one task may hold, how many can be written at once, and how far
 * back the list reaches before older days move to their own pages.
 */
// One task is a line, not a document, but a line can be a long one (it was 300)
export const TASK_MAX_LENGTH = 900

/**
 * **A daily task's description is one of the plain text boxes** (`TEXT_BOX_MAX_LENGTH`, a million
 * characters), at the owner's request: a task's details are notes they write and read themselves,
 * and nothing but the user ever reads the whole of one. Each daily task is its own document, so a
 * long description costs that task's record alone.
 *
 * The shared `TASK_DESCRIPTION_MAX_LENGTH` (6,000) stays where it is for an **employee's plan**,
 * whose tasks all live in one array inside one document, and is still all a model is ever handed
 * (`AI_DESCRIPTION_MAX_CHARS`), since a context window is paid for by the token.
 */
export const DAILY_TASK_DESCRIPTION_MAX_LENGTH = TEXT_BOX_MAX_LENGTH
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
  descriptionTooLong: `A description must be under ${DAILY_TASK_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters.`,
  tooManyTasks: `You can add ${MAX_TASKS_PER_SUBMIT} tasks at a time.`,
  invalidDate: "Pick a valid task date.",
  futureDate: "Tasks can be added for today or an earlier day.",
  invalidTask: "That task no longer exists.",
  invalidPriority: "Choose High, Medium or Low.",
  // Showing one priority only: the control sits in the list's own heading row, so it costs no height
  filterAll: "All priorities",
  filterOn: "Showing one priority. Choose All priorities to see them all again.",
  filterNote: "Showing one priority",
  noneOfThatPriority: "No task of that priority on these days. Try another page, or show them all.",
  // Dragging is off while a priority is being shown, because the list is not the whole day's order
  filterNoDrag: "Showing one priority, so the tasks can't be dragged into a new order.",
  saved: "Tasks added.",
  saveFailed: "Couldn't add the tasks. Please try again.",
  loadFailed: "Couldn't load your tasks.",
  updateFailed: "Couldn't update that task. Please try again.",
  // The description and image on a task already written, changed from its details popup
  detailsSaved: "Details saved.",
  detailsFailed: "Couldn't save those details. Please try again.",
  taskDeleted: "Task deleted.",
  deleteFailed: "Couldn't delete that task. Please try again.",
  moveFailed: "Couldn't move that task, so it is back where it was. Please try again.",
  // Bringing what was left open on earlier days onto today, from the button rather than a drag
  moveOverdue: (count: number) => `Move ${count} overdue ${count === 1 ? "task" : "tasks"} to today`,
  moveThisOverdue: "Move this task to today",
  movedOverdue: (count: number) =>
    count === 0 ? "Nothing was overdue." : `${count} ${count === 1 ? "task" : "tasks"} moved to today.`,
  moveOverdueFailed: "Couldn't move the overdue tasks. Please try again.",
  invalidOrder: "That new order doesn't match the tasks on that day. Reload and try again.",
  addToDayFailed: "Couldn't add that task. Please try again.",
  cleanupFailed: "Couldn't delete the older tasks. Please try again.",
  cleaned: "Older tasks deleted.",
  nothingToClean: "There was nothing older than a week to delete.",
  // "on the left" was the column that wrote the tasks; they are written in the Add task popup now
  empty: "No tasks for the last seven days yet. Write today's with Add task above.",
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
