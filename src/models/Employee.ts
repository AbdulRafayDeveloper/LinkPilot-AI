import mongoose, { Schema, type Model } from "mongoose"
import { EMPLOYEE_STATUS_IDS, STORED_PLAN_PERIODS, type EmployeeStatus } from "@/constants/employees"
import { TASK_IMAGE_TYPES } from "@/constants/taskAttachments"
import type { TaskImage } from "@/types/taskAttachment"
import { OWNER_ID } from "./owner"

/**
 * One employee with their daily plan (the tasks that repeat every day, in order), and one record per
 * employee per day (the unique index) holding that day's copy of the tasks with its ticks, which is
 * what the history reads. Weekly and monthly plans from before plans became daily-only are still
 * stored, under the first day they covered, and never read.
 */
export interface IEmployee {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  city: string
  role: string
  // YYYY-MM-DD, compared as text like every other day in the app
  joiningDate: string
  status: EmployeeStatus
  // Where they sit in the team list, set by dragging; ties (employees from before positions) list newest first
  position: number
  // The employee's own link to their daily plan (lib/planLink.ts). The link is signed with this
  // version, so replacing it (a new version) stops every earlier link working
  planLinkActive: boolean
  planLinkVersion: number
  // The plan that repeats every day, and the manager's notes about it
  planItems: IPlanTask[]
  planNotes: string
  // When the repeating plan was first set; null until then, so a plan made per day before it existed
  // can be taken over once
  planStartedAt: Date | null
  // The day the employee is working on (YYYY-MM-DD). It never turns over by itself at midnight: it
  // moves on only when they start a new day from their link, so someone still working at 1am keeps
  // the same list. Null until their first day is opened
  planDay: string | null
  // The order the employee dragged their tasks into on their link: their own view only, never the
  // plan's order. Empty means the plan's order; Reset today empties it
  linkOrder: string[]
  createdAt: Date
  updatedAt: Date
}

export interface IPlanTask {
  id: string
  text: string
  // The optional note under the task (formatted text) and the images it carries; empty on a plain
  // task. `image` is the first version's one image, kept until the task's images are next saved
  description: string
  image: TaskImage | null
  images: TaskImage[]
  // The plan task this one is a subtask of, by id, or null; three levels at most (TASK_MAX_DEPTH)
  parentId: string | null
}

// Only ever the id the server issued and the type it was uploaded as (services/taskImages.ts)
const TaskImageSchema = new Schema<TaskImage>(
  {
    assetId: { type: String, required: true },
    contentType: { type: String, required: true, enum: TASK_IMAGE_TYPES },
  },
  { _id: false }
)

const PlanTaskSchema = new Schema<IPlanTask>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: TaskImageSchema, default: null },
    images: { type: [TaskImageSchema], default: [] },
    parentId: { type: String, default: null },
  },
  { _id: false }
)

const EmployeeSchema = new Schema<IEmployee>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    joiningDate: { type: String, required: true },
    status: { type: String, enum: EMPLOYEE_STATUS_IDS, required: true, default: "active" },
    position: { type: Number, required: true, default: 0 },
    planLinkActive: { type: Boolean, default: false },
    planLinkVersion: { type: Number, default: 0 },
    planItems: { type: [PlanTaskSchema], default: [] },
    planNotes: { type: String, default: "" },
    planStartedAt: { type: Date, default: null },
    planDay: { type: String, default: null },
    linkOrder: { type: [String], default: [] },
  },
  { timestamps: true, collection: "employees" }
)
// Newest first with a stable tie-break, for the cursor-paged list
// The team list, in the order it was dragged into, newest first where no order was set
EmployeeSchema.index({ position: 1, createdAt: -1, _id: -1 })

export const EmployeeModel = (mongoose.models.Employee as Model<IEmployee> | undefined) ?? mongoose.model<IEmployee>("Employee", EmployeeSchema)

export interface IPlanItem {
  id: string
  text: string
  // The day's own copy of the detail the plan's task carried when the day was written
  description: string
  image: TaskImage | null
  images: TaskImage[]
  // The same subtask shape the plan had that day
  parentId: string | null
  done: boolean
  // When it was ticked off; cleared when it is unticked
  completedAt: Date | null
  // Why it wasn't finished, in the employee's own words; null while there is none, and cleared when
  // the task is ticked off. It belongs to this day only, like the tick
  reason: string | null
}

export interface IEmployeePlan {
  ownerId: string | null
  employeeId: string
  period: (typeof STORED_PLAN_PERIODS)[number]
  // The day the plan is for (YYYY-MM-DD)
  periodStart: string
  items: IPlanItem[]
  notes: string
  createdAt: Date
  updatedAt: Date
}

const PlanItemSchema = new Schema<IPlanItem>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: TaskImageSchema, default: null },
    images: { type: [TaskImageSchema], default: [] },
    parentId: { type: String, default: null },
    done: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, default: null },
    reason: { type: String, default: null },
  },
  { _id: false }
)

const EmployeePlanSchema = new Schema<IEmployeePlan>(
  {
    ownerId: OWNER_ID,
    employeeId: { type: String, required: true },
    period: { type: String, enum: STORED_PLAN_PERIODS, required: true },
    periodStart: { type: String, required: true },
    items: { type: [PlanItemSchema], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "employee_plans" }
)
EmployeePlanSchema.index({ employeeId: 1, period: 1, periodStart: 1 }, { unique: true })

export const EmployeePlanModel =
  (mongoose.models.EmployeePlan as Model<IEmployeePlan> | undefined) ?? mongoose.model<IEmployeePlan>("EmployeePlan", EmployeePlanSchema)
