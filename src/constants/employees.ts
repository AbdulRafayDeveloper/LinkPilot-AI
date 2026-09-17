import { Contact, type LucideIcon } from "lucide-react"

/**
 * Employees Management: the people on the team (name, city, role, date of joining, active or not)
 * and a daily plan for each of them, with the time every task was ticked off. Each employee can
 * have a private link that opens their own daily plan without signing in. Like every workspace
 * module, an employee belongs to the account that added them; an admin sees everyone's.
 */

export const EMPLOYEES_ENDPOINT = "/api/employees"

export const EMPLOYEE_STATUSES = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]["id"]
export const EMPLOYEE_STATUS_IDS = EMPLOYEE_STATUSES.map((status) => status.id) as [EmployeeStatus, ...EmployeeStatus[]]

// Plans are daily. Weekly and monthly plans made before that change stay stored as they were, but
// are never listed, read or written again
export const PLAN_PERIOD = "daily"
export const STORED_PLAN_PERIODS = ["daily", "weekly", "monthly"] as const

// The page an employee opens from their link, and the calls it makes, both reachable signed out
export const PUBLIC_PLAN_PATH = "/plan"
export const PUBLIC_PLAN_ENDPOINT = "/api/public/plans"
// A "today" from the employee's browser may be at most this far from the server's UTC day
export const PLAN_TODAY_DRIFT_DAYS = 1
// Past days with a plan shown at once in the history; older ones load on request
export const PLAN_HISTORY_DAYS = 14

export const EMPLOYEE_NAME_MAX_LENGTH = 100
export const EMPLOYEE_CITY_MAX_LENGTH = 80
export const EMPLOYEE_ROLE_MAX_LENGTH = 80
export const PLAN_ITEM_MAX_LENGTH = 300
export const PLAN_MAX_ITEMS = 50
export const PLAN_NOTES_MAX_LENGTH = 4000
// Changes to a plan are saved once typing settles for this long
export const PLAN_SAVE_DELAY_MS = 800

export const EMPLOYEE_MESSAGES = {
  missingName: "Add the employee's name.",
  nameTooLong: `Keep the name under ${EMPLOYEE_NAME_MAX_LENGTH} characters.`,
  missingCity: "Add the city they work from.",
  cityTooLong: `Keep the city under ${EMPLOYEE_CITY_MAX_LENGTH} characters.`,
  missingRole: "Add their role.",
  roleTooLong: `Keep the role under ${EMPLOYEE_ROLE_MAX_LENGTH} characters.`,
  badJoiningDate: "Pick the date they joined.",
  futureJoiningDate: "The joining date can't be more than a year from now.",
  badStatus: "Choose Active or Inactive.",
  notFound: "That employee no longer exists.",
  loadFailed: "Couldn't load the employees. Please try again.",
  saveFailed: "Couldn't save the employee. Please try again.",
  deleteFailed: "Couldn't delete the employee. Please try again.",
  planLoadFailed: "Couldn't load this plan. Please try again.",
  planSaveFailed: "Couldn't save the plan. Your changes are still here; try again.",
  tickFailed: "Couldn't save that tick. Please try again.",
  badPlanDate: "Pick a valid day for the plan.",
  badToday: "Your device's date looks wrong, so today's plan can't be changed. Check the date and try again.",
  historyFailed: "Couldn't load the history. Please try again.",
  linkInvalid: "This link doesn't open a plan. It may have been replaced or turned off; ask for a new one.",
  linkFailed: "Couldn't change the link. Please try again.",
  resetFailed: "Couldn't reset today's ticks. Please try again.",
  itemNotFound: "That task is no longer on today's plan.",
  orderChanged: "The plan changed while you were moving tasks. It has been reloaded; try again.",
  orderFailed: "Couldn't save the new order. Please try again.",
  tooManyItems: `A plan holds up to ${PLAN_MAX_ITEMS} items.`,
  itemTooLong: `Keep each plan item under ${PLAN_ITEM_MAX_LENGTH} characters.`,
  notesTooLong: `Keep the notes under ${PLAN_NOTES_MAX_LENGTH.toLocaleString()} characters.`,
  created: "Employee added.",
  saved: "Employee saved.",
  deleted: "Employee deleted.",
} as const

export const EMPLOYEES_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
} = {
  id: "employees",
  title: "Employees Management",
  description: "Your team, their daily plans and plan links",
  icon: Contact,
  href: "/employees",
  group: "workspace",
}
