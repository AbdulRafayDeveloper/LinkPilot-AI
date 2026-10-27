import mongoose, { Schema, type Model } from "mongoose"
import { ACTIVITY_ACTION_IDS, ACTIVITY_OUTCOME_IDS, type ActivityAction, type ActivityOutcome } from "@/constants/activityLogs"

/**
 * One action an account took (constants/activityLogs.ts). It belongs to the person who took it
 * (`userId`, the account's own id, never the workspace it works in), and holds what was done, where
 * and from which device, never the request's body: what was typed into a tool is that tool's record,
 * not the log's.
 *
 * `deletedAt` is the person's own delete: the activity leaves their list and stays here for the
 * administrators, who see it marked. Only an admin removes a row from the database.
 */
export interface IActivityLog {
  userId: string
  action: ActivityAction
  outcome: ActivityOutcome
  // The tool's id, or the part of the app that is not a tool ("account", "administration")
  module: string
  resource: string
  method: string
  path: string
  targetId: string | null
  // The same request repeated within a minute is one activity seen this many times
  count: number
  lastAt: Date
  browser: string
  os: string
  device: string
  userAgent: string
  ipAddress: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: String, required: true },
    action: { type: String, enum: ACTIVITY_ACTION_IDS, required: true },
    outcome: { type: String, enum: ACTIVITY_OUTCOME_IDS, required: true },
    module: { type: String, required: true },
    resource: { type: String, default: "" },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    targetId: { type: String, default: null },
    count: { type: Number, default: 1, min: 1 },
    lastAt: { type: Date, required: true },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    device: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "activity_logs" }
)
// One person's list newest first (with or without what they deleted), the module filter, and the
// lookup that folds a repeated request into the activity it repeats
ActivityLogSchema.index({ userId: 1, deletedAt: 1, createdAt: -1, _id: -1 })
ActivityLogSchema.index({ userId: 1, module: 1, createdAt: -1 })
ActivityLogSchema.index({ userId: 1, method: 1, path: 1, lastAt: -1 })

export const ActivityLogModel =
  (mongoose.models.ActivityLog as Model<IActivityLog> | undefined) ?? mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema)
