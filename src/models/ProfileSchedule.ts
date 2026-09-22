import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"
import { PERSON_TYPE_IDS, WEEK_DAY_IDS, type PersonTypeId, type WeekDayId } from "@/constants/profileScheduler"

/**
 * One person in Comment Writer's Profile Scheduler: who they are (name, role, location, sector), why
 * they are on the list (their types), their LinkedIn link, kept in one form (lib/linkedinProfile.ts),
 * and the days of the week their posts are looked at. The link is null for someone whose profile
 * hasn't been found yet; a record saved before people had details reads with those fields empty.
 */
export interface IProfileSchedule {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  profileUrl: string | null
  name: string
  role: string
  location: string
  sector: string
  // In PERSON_TYPES order, each once
  types: PersonTypeId[]
  // In week order, Monday first, each once
  days: WeekDayId[]
  createdAt: Date
  updatedAt: Date
}

const ProfileScheduleSchema = new Schema<IProfileSchedule>(
  {
    ownerId: OWNER_ID,
    profileUrl: { type: String, default: null, trim: true },
    name: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    sector: { type: String, default: "", trim: true },
    types: { type: [{ type: String, enum: PERSON_TYPE_IDS }], default: [] },
    days: { type: [{ type: String, enum: WEEK_DAY_IDS }], required: true },
  },
  { timestamps: true, collection: "profile_schedules" }
)
// One account keeps a profile link once, while any number of people may still be waiting for theirs
// (scripts/migrate-profile-people.mjs replaced the index that made the link required and unique)
ProfileScheduleSchema.index(
  { ownerId: 1, profileUrl: 1 },
  { unique: true, name: "ownerId_1_profileUrl_1_linked", partialFilterExpression: { profileUrl: { $type: "string" } } }
)
// Newest first with a stable tie-break for the pages, and one account's profiles on one day or of one type for the filters
ProfileScheduleSchema.index({ createdAt: -1, _id: -1 })
ProfileScheduleSchema.index({ ownerId: 1, days: 1 })
ProfileScheduleSchema.index({ ownerId: 1, types: 1 })

export const ProfileScheduleModel =
  (mongoose.models.ProfileSchedule as Model<IProfileSchedule> | undefined) ??
  mongoose.model<IProfileSchedule>("ProfileSchedule", ProfileScheduleSchema)
