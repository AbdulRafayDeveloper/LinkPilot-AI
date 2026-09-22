import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { allOf, searchCondition } from "@/lib/listQuery"
import { ProfileScheduleModel, type IProfileSchedule } from "@/models/ProfileSchedule"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { PROFILE_SCHEDULER_MESSAGES, WEEK_DAY_IDS, type WeekDayId } from "@/constants/profileScheduler"
import type { ProfileSchedule, ProfileScheduleInput, ProfileSchedulePage } from "@/types/profileScheduler"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Comment Writer's Profile Scheduler: the profiles an account comments on and the days of the week
 * for each, read a page at a time, exactly HISTORY_PAGE_SIZE (50) to a page, newest first, searched
 * by link and filtered by day in the database. A profile belongs to the account that saved it; a
 * user sees their own, an admin everyone's. One account keeps a profile once.
 */

type StoredSchedule = IProfileSchedule & { _id: { toString: () => string } }
type Filters = { search: string; day: WeekDayId | "" }

const DUPLICATE_KEY = 11000

const toSchedule = (record: StoredSchedule): ProfileSchedule => ({
  id: record._id.toString(),
  profileUrl: record.profileUrl,
  days: WEEK_DAY_IDS.filter((day) => record.days.includes(day)),
  createdAt: new Date(record.createdAt).toISOString(),
  updatedAt: new Date(record.updatedAt).toISOString(),
})

/** Exactly the profiles a search and a day cover, so the list and a bulk delete can never differ. */
const matchingFilter = (scope: Record<string, unknown>, filters: Filters) =>
  allOf([scope, searchCondition(filters.search, ["profileUrl"]), filters.day ? { days: filters.day } : null])

/** How many of the viewer's profiles each day has, whatever the search, for the day filter. */
async function countDays(viewer: Viewer): Promise<Record<WeekDayId, number>> {
  const rows = (await ProfileScheduleModel.aggregate([
    { $match: visibleTo(viewer) },
    { $unwind: "$days" },
    { $group: { _id: "$days", count: { $sum: 1 } } },
  ])) as { _id: string; count: number }[]
  return Object.fromEntries(WEEK_DAY_IDS.map((day) => [day, rows.find((row) => row._id === day)?.count ?? 0])) as Record<WeekDayId, number>
}

// The same profile saved twice by one account, found before the unique index has to refuse it
async function assertNotSaved(viewer: Viewer, profileUrl: string, exceptId?: string) {
  const taken = await ProfileScheduleModel.exists({
    ownerId: viewer.id,
    profileUrl,
    ...(exceptId ? { _id: { $ne: new mongoose.Types.ObjectId(exceptId) } } : {}),
  })
  if (taken) throw new UserFacingError(PROFILE_SCHEDULER_MESSAGES.duplicate)
}

// Two saves of one profile at the same moment both pass the check; the index keeps one and this names the other
const asDuplicate = (error: unknown) =>
  error && typeof error === "object" && "code" in error && error.code === DUPLICATE_KEY ? new UserFacingError(PROFILE_SCHEDULER_MESSAGES.duplicate) : error

/**
 * One page of profiles. A page past the end comes back as the last page rather than as nothing,
 * so deleting the last profile on the last page never leaves an empty screen.
 */
export async function listProfileSchedules(viewer: Viewer, filters: Filters & { page: number }): Promise<ProfileSchedulePage> {
  await connectDatabase()
  const pageSize = HISTORY_PAGE_SIZE
  const matching = matchingFilter(visibleTo(viewer), filters)
  const [total, dayCounts] = await Promise.all([ProfileScheduleModel.countDocuments(matching), countDays(viewer)])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const records = (await ProfileScheduleModel.find(matching)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as StoredSchedule[]
  return { items: records.map(toSchedule), page, pageSize, total, totalPages, dayCounts }
}

/** Saves a profile to this account. The same profile a second time is refused as a duplicate. */
export async function createProfileSchedule(viewer: Viewer, input: ProfileScheduleInput): Promise<ProfileSchedule> {
  await connectDatabase()
  await assertNotSaved(viewer, input.profileUrl)
  try {
    const record = await ProfileScheduleModel.create({ ownerId: viewer.id, profileUrl: input.profileUrl, days: input.days })
    return toSchedule(record.toObject() as unknown as StoredSchedule)
  } catch (error: unknown) {
    throw asDuplicate(error)
  }
}

/** Replaces a profile's link and days. Null when it's gone or belongs to another account. */
export async function updateProfileSchedule(viewer: Viewer, id: string, input: ProfileScheduleInput): Promise<ProfileSchedule | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  // A profile that is gone is not found, whatever link the edit carries
  if (!(await ProfileScheduleModel.exists(filter))) return null
  await assertNotSaved(viewer, input.profileUrl, id)
  try {
    const record = (await ProfileScheduleModel.findOneAndUpdate(
      filter,
      { $set: { profileUrl: input.profileUrl, days: input.days } },
      { returnDocument: "after", runValidators: true }
    ).lean()) as unknown as StoredSchedule | null
    return record ? toSchedule(record) : null
  } catch (error: unknown) {
    throw asDuplicate(error)
  }
}

export async function deleteProfileSchedule(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  return Boolean(await ProfileScheduleModel.findOneAndDelete(filter, { projection: { _id: 1 } }).lean())
}

/**
 * Deletes several profiles at once: the ones named by `ids` (inside what the viewer may see, like
 * the single delete), or every profile the search and day cover (only the viewer's own, like Clear
 * All). Answers how many were really deleted.
 */
export async function deleteProfileSchedules(viewer: Viewer, filters: Filters, ids?: string[]): Promise<{ deleted: number }> {
  await connectDatabase()
  const matching = matchingFilter(ids ? visibleTo(viewer) : ownedBy(viewer), filters)
  const chosen = ids ? { $and: [matching, { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }] } : matching
  const { deletedCount } = await ProfileScheduleModel.deleteMany(chosen)
  return { deleted: deletedCount ?? 0 }
}
