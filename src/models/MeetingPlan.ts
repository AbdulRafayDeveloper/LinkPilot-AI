import mongoose, { Schema, type Model } from "mongoose"
import {
  ISO_DATE_PATTERN,
  MEETING_PLAN_STATUS_IDS,
  PREP_STATUSES,
  TIME_PATTERN,
  type MeetingPlanStatusId,
  type PrepStatusId,
} from "@/constants/meetingPlanner"
import { OWNER_ID } from "./owner"

/**
 * One meeting that hasn't happened yet: when it is, who it is with, and (when preparation is on)
 * what the user supplied about them plus the preparation written from it. The inputs and the
 * generated preparation are kept apart, so a failed or repeated run never costs what was typed.
 *
 * The day and time are plain strings from the browser's clock (YYYY-MM-DD and HH:mm), never
 * timestamps, so a meeting stays on the day and hour the user chose whatever timezone the server
 * runs in. The app has no accounts, so meetings belong to whoever opens it, like every other
 * saved module.
 */
export interface IMeetingPlan {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  meetingDate: string
  meetingTime: string
  status: MeetingPlanStatusId
  completedAt: Date | null
  personName: string | null
  // A link straight to their profile, read from what was pasted or typed by the user
  profileLink: string | null
  prepEnabled: boolean
  profileInfo: string | null
  conversationHistory: string | null
  additionalInfo: string | null
  prepStatus: PrepStatusId
  prepError: string | null
  // The whole MeetingPrep, validated against its schema before it is written
  prep: unknown
  preparedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const MeetingPlanSchema = new Schema<IMeetingPlan>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    meetingDate: { type: String, required: true, match: ISO_DATE_PATTERN },
    meetingTime: { type: String, required: true, match: TIME_PATTERN },
    status: { type: String, enum: MEETING_PLAN_STATUS_IDS, required: true, default: "pending" },
    completedAt: { type: Date, default: null },
    personName: { type: String, default: null, trim: true },
    profileLink: { type: String, default: null, trim: true },
    prepEnabled: { type: Boolean, required: true, default: false },
    profileInfo: { type: String, default: null },
    conversationHistory: { type: String, default: null },
    additionalInfo: { type: String, default: null },
    prepStatus: { type: String, enum: PREP_STATUSES, required: true, default: "off" },
    prepError: { type: String, default: null },
    prep: { type: Schema.Types.Mixed, default: null },
    preparedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "meeting_plans" }
)
// The calendar and today both read a range of days, earliest meeting of a day first
MeetingPlanSchema.index({ meetingDate: 1, meetingTime: 1, _id: 1 })
// Counting what is still pending on a day
MeetingPlanSchema.index({ status: 1, meetingDate: 1 })

export const MeetingPlan =
  (mongoose.models.MeetingPlan as Model<IMeetingPlan> | undefined) ??
  mongoose.model<IMeetingPlan>("MeetingPlan", MeetingPlanSchema)
