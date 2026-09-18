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
  // The optional note under the task, and the one image it carries; both empty on a plain task
  description: string
  image: TaskImage | null
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

export const DailyTask =
  (mongoose.models.DailyTask as Model<IDailyTask> | undefined) ?? mongoose.model<IDailyTask>("DailyTask", DailyTaskSchema)
