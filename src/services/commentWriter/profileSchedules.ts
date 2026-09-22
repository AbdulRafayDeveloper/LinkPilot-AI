import mongoose from "mongoose"
import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { allOf, searchCondition } from "@/lib/listQuery"
import { ProfileScheduleModel, type IProfileSchedule } from "@/models/ProfileSchedule"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { PERSON_TYPE_IDS, PROFILE_SCHEDULER_MESSAGES, WEEK_DAY_IDS, type PersonTypeId, type WeekDayId } from "@/constants/profileScheduler"
import type { ProfilePersonFields, ProfileSchedule, ProfileSchedulePage } from "@/types/profileScheduler"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Comment Writer's Profile Scheduler: the people an account comments on (name, role, location,
 * sector, types and LinkedIn link) and the days of the week for each, read a page at a time, exactly
 * HISTORY_PAGE_SIZE (50) to a page, newest first, searched by the link and the details and filtered
 * by day and type in the database. A person belongs to the account that saved them; a user sees
 * their own, an admin everyone's. One account keeps a LinkedIn link once; people still waiting for
 * their link are kept apart by name only in the page, never refused.
 */

type StoredSchedule = IProfileSchedule & { _id: { toString: () => string } }
type Filters = { search: string; day: WeekDayId | ""; type?: PersonTypeId | "" }

// What a search reads: the link and every detail typed about the person
const SEARCHED = ["profileUrl", "name", "role", "location", "sector"]

const DUPLICATE_KEY = 11000

const toSchedule = (record: StoredSchedule): ProfileSchedule => ({
  id: record._id.toString(),
  profileUrl: record.profileUrl ?? null,
  // A person saved before people had details reads with them empty
  name: record.name ?? "",
  role: record.role ?? "",
  location: record.location ?? "",
  sector: record.sector ?? "",
  types: PERSON_TYPE_IDS.filter((type) => (record.types ?? []).includes(type)),
  days: WEEK_DAY_IDS.filter((day) => record.days.includes(day)),
  createdAt: new Date(record.createdAt).toISOString(),
  updatedAt: new Date(record.updatedAt).toISOString(),
})

/** Exactly the profiles a search and a day cover, so the list and a bulk delete can never differ. */
const matchingFilter = (scope: Record<string, unknown>, filters: Filters) =>
  allOf([scope, searchCondition(filters.search, SEARCHED), filters.day ? { days: filters.day } : null, filters.type ? { types: filters.type } : null])

/** How many of the viewer's profiles each day has, whatever the search, for the day filter. */
async function countDays(viewer: Viewer): Promise<Record<WeekDayId, number>> {
  const rows = (await ProfileScheduleModel.aggregate([
    { $match: visibleTo(viewer) },
    { $unwind: "$days" },
    { $group: { _id: "$days", count: { $sum: 1 } } },
  ])) as { _id: string; count: number }[]
  return Object.fromEntries(WEEK_DAY_IDS.map((day) => [day, rows.find((row) => row._id === day)?.count ?? 0])) as Record<WeekDayId, number>
}

/** How many of the viewer's profiles each type has, whatever the search, for the type filter. */
async function countTypes(viewer: Viewer): Promise<Record<PersonTypeId, number>> {
  const rows = (await ProfileScheduleModel.aggregate([
    { $match: visibleTo(viewer) },
    { $unwind: "$types" },
    { $group: { _id: "$types", count: { $sum: 1 } } },
  ])) as { _id: string; count: number }[]
  return Object.fromEntries(PERSON_TYPE_IDS.map((type) => [type, rows.find((row) => row._id === type)?.count ?? 0])) as Record<PersonTypeId, number>
}

// The same profile saved twice by one account, found before the unique index has to refuse it
async function assertNotSaved(viewer: Viewer, profileUrl: string | null | undefined, exceptId?: string) {
  // Any number of people may be waiting for their link
  if (!profileUrl) return
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
  const [total, dayCounts, typeCounts] = await Promise.all([ProfileScheduleModel.countDocuments(matching), countDays(viewer), countTypes(viewer)])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)
  const records = (await ProfileScheduleModel.find(matching)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as StoredSchedule[]
  return { items: records.map(toSchedule), page, pageSize, total, totalPages, dayCounts, typeCounts }
}

// The fields an edit carries, and nothing it left out, so a field left out keeps what was saved
const setFields = (input: ProfilePersonFields) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<ProfilePersonFields>

/** Saves a person to this account. The same LinkedIn link a second time is refused as a duplicate. */
export async function createProfileSchedule(viewer: Viewer, input: ProfilePersonFields): Promise<ProfileSchedule> {
  await connectDatabase()
  await assertNotSaved(viewer, input.profileUrl)
  try {
    const record = await ProfileScheduleModel.create({
      ownerId: viewer.id,
      profileUrl: input.profileUrl ?? null,
      name: input.name ?? "",
      role: input.role ?? "",
      location: input.location ?? "",
      sector: input.sector ?? "",
      types: input.types ?? [],
      days: input.days,
    })
    return toSchedule(record.toObject() as unknown as StoredSchedule)
  } catch (error: unknown) {
    throw asDuplicate(error)
  }
}

/**
 * Changes a person: the fields the edit carries, the others as they were. Null when they're gone or
 * belong to another account. An edit that would leave them with neither a name nor a link is refused.
 */
export async function updateProfileSchedule(viewer: Viewer, id: string, input: ProfilePersonFields): Promise<ProfileSchedule | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  // A person who is gone is not found, whatever the edit carries
  const current = (await ProfileScheduleModel.findOne(filter, { profileUrl: 1, name: 1 }).lean()) as { profileUrl?: string | null; name?: string } | null
  if (!current) return null
  const changes = setFields(input)
  const profileUrl = changes.profileUrl !== undefined ? changes.profileUrl : (current.profileUrl ?? null)
  const name = changes.name !== undefined ? changes.name : (current.name ?? "")
  if (!profileUrl && !name) throw new UserFacingError(PROFILE_SCHEDULER_MESSAGES.missingPerson)
  await assertNotSaved(viewer, changes.profileUrl, id)
  try {
    const record = (await ProfileScheduleModel.findOneAndUpdate(
      filter,
      { $set: changes },
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
