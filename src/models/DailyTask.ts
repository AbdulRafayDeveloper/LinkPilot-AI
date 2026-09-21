import mongoose, { Schema, type Model } from "mongoose"

import { ISO_DATE_PATTERN } from "@/constants/dailyTasks"
import { TASK_IMAGE_TYPES } from "@/constants/taskAttachments"
import type { TaskImage } from "@/types/taskAttachment"
import { OWNER_ID } from "./owner"

/**
 * One task on one day. The day is a plain calendar date (YYYY-MM-DD) taken from the browser's
 * own clock, so a task stays on the day it was written for whatever the server's timezone is.
 * The app has no accounts, so tasks belong to whoever opens it, exactly like Quick Notes.
 */
export interface IDailyTask {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  content: string
  // The optional note under the task (formatted text) and the images it carries; empty on a plain task.
  // `image` is the first version's one image: a task saved then keeps it until its images are next saved
  description: string
  image: TaskImage | null
  images: TaskImage[]
  // The task this one is a subtask of, on the same day, or null for a task of its own. Three levels
  // at most (TASK_MAX_DEPTH); a task saved before subtasks existed has none
  parentTaskId: mongoose.Types.ObjectId | null
  taskDate: string
  // Where the task sits within its day, set by dragging; ties (tasks from before positions) keep the order they were written
  position: number
  isCompleted: boolean
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Only ever the id the server issued and the type it was uploaded as; the object's key is built
// from those (services/taskImages.ts), never from anything the browser sends
const TaskImageSchema = new Schema<TaskImage>(
  {
    assetId: { type: String, required: true },
    contentType: { type: String, required: true, enum: TASK_IMAGE_TYPES },
  },
  { _id: false }
)

const DailyTaskSchema = new Schema<IDailyTask>(
  {
    ownerId: OWNER_ID,
    content: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: { type: TaskImageSchema, default: null },
    images: { type: [TaskImageSchema], default: [] },
    parentTaskId: { type: Schema.Types.ObjectId, default: null },
    taskDate: { type: String, required: true, match: ISO_DATE_PATTERN },
    position: { type: Number, required: true, default: 0 },
    isCompleted: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "daily_tasks" }
)
// The list and the cleanup both work on a range of days, newest first, and read the tasks of a
// day in the order they were placed
DailyTaskSchema.index({ taskDate: -1, position: 1, createdAt: 1, _id: 1 })
// Counting what is still open before today (the overdue badge)
DailyTaskSchema.index({ isCompleted: 1, taskDate: -1 })
// A task's subtasks, for the list, a copy and a delete that takes them with it
DailyTaskSchema.index({ parentTaskId: 1 })

export const DailyTask =
  (mongoose.models.DailyTask as Model<IDailyTask> | undefined) ?? mongoose.model<IDailyTask>("DailyTask", DailyTaskSchema)
