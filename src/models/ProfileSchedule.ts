import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"
import { WEEK_DAY_IDS, type WeekDayId } from "@/constants/profileScheduler"

/**
 * One LinkedIn profile in Comment Writer's Profile Scheduler: its link, kept in one form
 * (lib/linkedinProfile.ts), and the days of the week it is looked at.
 */
export interface IProfileSchedule {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  profileUrl: string
  // In week order, Monday first, each once
  days: WeekDayId[]
  createdAt: Date
  updatedAt: Date
}

const ProfileScheduleSchema = new Schema<IProfileSchedule>(
  {
    ownerId: OWNER_ID,
    profileUrl: { type: String, required: true, trim: true },
    days: { type: [{ type: String, enum: WEEK_DAY_IDS }], required: true },
  },
  { timestamps: true, collection: "profile_schedules" }
)
// One account keeps a profile once; the service answers a second save as a duplicate before this refuses it
ProfileScheduleSchema.index({ ownerId: 1, profileUrl: 1 }, { unique: true })
// Newest first with a stable tie-break for the pages, and one account's profiles on one day for the filter
ProfileScheduleSchema.index({ createdAt: -1, _id: -1 })
ProfileScheduleSchema.index({ ownerId: 1, days: 1 })

export const ProfileScheduleModel =
  (mongoose.models.ProfileSchedule as Model<IProfileSchedule> | undefined) ??
  mongoose.model<IProfileSchedule>("ProfileSchedule", ProfileScheduleSchema)
