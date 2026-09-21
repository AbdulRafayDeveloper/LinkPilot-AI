import type { EmployeeStatus } from "@/constants/employees"
import type { TaskImage, TaskImageView } from "./taskAttachment"

export interface Employee {
  id: string
  name: string
  city: string
  role: string
  // YYYY-MM-DD
  joiningDate: string
  status: EmployeeStatus
  // The token of the employee's own plan link (PUBLIC_PLAN_PATH/<token>), or null while it is off
  planLink: string | null
  // The account that added them, named only for an admin (who sees every account's employees)
  owner: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeInput {
  name: string
  city: string
  role: string
  joiningDate: string
  status: EmployeeStatus
}

export interface EmployeesPage {
  items: Employee[]
  nextCursor: string | null
  total: number
  // Across every employee the viewer may see, whatever the filters
  counts: { active: number; inactive: number }
}

export interface PlanItem {
  id: string
  text: string
  // The optional note under the task, as formatted text (lib/richText.ts); empty when it has none
  description: string
  // The images on it, each with a short-lived link to show it from
  images: TaskImageView[]
  // The first of them, as the first version answered
  image: TaskImageView | null
  // The plan task this one is a subtask of, or null; three levels at most
  parentId: string | null
  done: boolean
  // When it was ticked off, or null while it is open
  completedAt: string | null
  // Why it wasn't finished, written by the employee on their link; empty when there is none
  reason: string
}

/** The employee's plan as it stands today: the tasks that repeat every day, with today's ticks. */
export interface EmployeePlan {
  employeeId: string
  // Today, as the browser that asked sees it (YYYY-MM-DD)
  date: string
  items: PlanItem[]
  // The manager's notes about the plan; never shown on the employee's link
  notes: string
  // When today's record last changed, or null before it exists
  updatedAt: string | null
}

/** What the manager's editor saves: the plan's tasks (wording and order) and notes. Ticks are saved on their own. */
export interface EmployeePlanInput {
  today: string
  // In order, each subtask after its task; `parentId` and `images` are optional so older callers still fit
  items: { id: string; text: string; description: string; image: TaskImage | null; images?: TaskImage[]; parentId?: string | null }[]
  notes: string
}

/** A past day in the history: its tasks, with when each finished one was ticked off. */
export interface PlanHistoryDay {
  date: string
  items: PlanItem[]
  doneCount: number
}

export interface PlanHistoryPage {
  days: PlanHistoryDay[]
  // Pass as `before` for the next, older days; null when there are none
  nextBefore: string | null
}

/**
 * What an employee's link shows: who they are (name and role only), today's tasks and their past
 * days. Never the city, the joining date, the notes, the owner or any other employee.
 */
export interface PublicPlan {
  employee: { name: string; role: string }
  // ownOrder: the employee moved the tasks into their own order on the link (Reset today undoes it)
  today: { date: string; items: PlanItem[]; ownOrder: boolean }
  history: PlanHistoryPage
}
