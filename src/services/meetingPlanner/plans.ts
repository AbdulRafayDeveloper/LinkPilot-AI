import mongoose from "mongoose"

import { connectDatabase } from "@/lib/db"
import { MeetingPlan as MeetingPlanModel, type IMeetingPlan } from "@/models/MeetingPlan"
import { monthEnd, monthStart } from "@/lib/meetingDates"
import type { MeetingPlan, MeetingPlanDetail, MeetingPlannerPage, MeetingPrep } from "@/types/meetingPlanner"
import { STALE_PREP_MS, type MeetingPlanStatusId } from "@/constants/meetingPlanner"

/**
 * Meetings live in the meeting_plans collection. The app has no accounts, so they belong to
 * whoever opens it, like Quick Notes, Daily Tasks and the saved Trending searches.
 *
 * Every read is a range of plain YYYY-MM-DD strings, which the compound index covers, so the
 * calendar never loads more than the month it shows.
 */
// What the calendar, today's list and the history rows draw; the long preparation inputs stay out
const LIST_FIELDS =
  "name meetingDate meetingTime status completedAt personName prepEnabled prepStatus prepError preparedAt createdAt"

type StoredPlan = IMeetingPlan & { _id: { toString: () => string } }

const toMeeting = (record: StoredPlan): MeetingPlan => ({
  id: record._id.toString(),
  name: record.name,
  meetingDate: record.meetingDate,
  meetingTime: record.meetingTime,
  status: record.status,
  completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  personName: record.personName ?? null,
  prepEnabled: record.prepEnabled,
  prepStatus: record.prepStatus,
  prepError: record.prepError ?? null,
  preparedAt: record.preparedAt ? record.preparedAt.toISOString() : null,
  createdAt: record.createdAt.toISOString(),
})

const toDetail = (record: StoredPlan): MeetingPlanDetail => ({
  ...toMeeting(record),
  profileInfo: record.profileInfo ?? null,
  conversationHistory: record.conversationHistory ?? null,
  additionalInfo: record.additionalInfo ?? null,
  prep: (record.prep as MeetingPrep | null) ?? null,
})

const byDayThenTime = { meetingDate: 1, meetingTime: 1, _id: 1 } as const

/**
 * One month for the calendar plus today's meetings, whichever month is on screen. Two indexed
 * range queries, so an empty month costs nothing and a busy one still reads only that month.
 */
export async function listMonth(month: string, today: string): Promise<MeetingPlannerPage> {
  await connectDatabase()
  const [monthRecords, todayRecords] = await Promise.all([
    MeetingPlanModel.find({ meetingDate: { $gte: monthStart(month), $lte: monthEnd(month) } }, LIST_FIELDS)
      .sort(byDayThenTime)
      .lean(),
    MeetingPlanModel.find({ meetingDate: today }, LIST_FIELDS).sort(byDayThenTime).lean(),
  ])
  const todayMeetings = (todayRecords as unknown as StoredPlan[]).map(toMeeting)
  return {
    month,
    meetings: (monthRecords as unknown as StoredPlan[]).map(toMeeting),
    today: todayMeetings,
    todayDate: today,
    pendingToday: todayMeetings.filter((meeting) => meeting.status === "pending").length,
  }
}

export interface NewMeetingPlan {
  name: string
  meetingDate: string
  meetingTime: string
  personName: string | null
  prepEnabled: boolean
  profileInfo: string | null
  conversationHistory: string | null
  additionalInfo: string | null
}

/**
 * Saves the meeting itself. Preparation, when it is switched on, runs afterwards in its own
 * request, so a slow or failing model never costs the meeting.
 */
export async function createMeeting(input: NewMeetingPlan): Promise<MeetingPlanDetail> {
  await connectDatabase()
  const record = await MeetingPlanModel.create({
    ...input,
    status: "pending",
    completedAt: null,
    prepStatus: input.prepEnabled ? "queued" : "off",
    prepError: null,
    prep: null,
    preparedAt: null,
  })
  return toDetail(record as unknown as StoredPlan)
}

export async function getMeeting(id: string): Promise<MeetingPlanDetail | null> {
  if (!mongoose.isValidObjectId(id)) return null
  await connectDatabase()
  const record = await MeetingPlanModel.findById(id).lean()
  return record ? toDetail(record as unknown as StoredPlan) : null
}

export interface MeetingPlanChanges {
  name?: string
  meetingDate?: string
  meetingTime?: string
  personName?: string | null
  status?: MeetingPlanStatusId
  prepEnabled?: boolean
  profileInfo?: string | null
  conversationHistory?: string | null
  additionalInfo?: string | null
}

/**
 * Changes the scheduling details, the status or the preparation inputs. Saved preparation is
 * never touched here: it is rewritten only when the user asks for it.
 */
export async function updateMeeting(id: string, changes: MeetingPlanChanges): Promise<MeetingPlanDetail | null> {
  if (!mongoose.isValidObjectId(id)) return null
  await connectDatabase()
  const update: Record<string, unknown> = { ...changes }
  // Ticking a meeting off records when, and reopening it clears that again
  if (changes.status) update.completedAt = changes.status === "completed" ? new Date() : null
  // Switching preparation off leaves what was written in place, and stops offering to run it
  if (changes.prepEnabled === false) update.prepStatus = "off"
  // Switching it on puts the meeting in the queue, unless something has already been written
  if (changes.prepEnabled === true) {
    const current = await MeetingPlanModel.findById(id, "prepStatus").lean()
    if (current?.prepStatus === "off") update.prepStatus = "queued"
  }
  const record = await MeetingPlanModel.findByIdAndUpdate(id, { $set: update }, { new: true, lean: true })
  return record ? toDetail(record as unknown as StoredPlan) : null
}

export async function deleteMeeting(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false
  await connectDatabase()
  const { deletedCount } = await MeetingPlanModel.deleteOne({ _id: id })
  return deletedCount > 0
}

/**
 * Marks a preparation run as started, but only when one isn't already running, so two clicks or
 * two tabs can't both call the model for the same meeting. A run whose request died without
 * saying so (a serverless function killed mid-flight) stops counting as running after
 * STALE_PREP_MS, so a meeting can never be stuck waiting on a request that no longer exists.
 */
export async function claimPrepRun(id: string): Promise<MeetingPlanDetail | null> {
  if (!mongoose.isValidObjectId(id)) return null
  await connectDatabase()
  const record = await MeetingPlanModel.findOneAndUpdate(
    {
      _id: id,
      prepEnabled: true,
      $or: [{ prepStatus: { $ne: "generating" } }, { updatedAt: { $lt: new Date(Date.now() - STALE_PREP_MS) } }],
    },
    { $set: { prepStatus: "generating", prepError: null } },
    { new: true, lean: true }
  )
  return record ? toDetail(record as unknown as StoredPlan) : null
}

/**
 * Saves a finished preparation, replacing whatever was there before.
 */
export async function savePrep(id: string, prep: MeetingPrep): Promise<MeetingPlanDetail | null> {
  await connectDatabase()
  const record = await MeetingPlanModel.findByIdAndUpdate(
    id,
    { $set: { prep, prepStatus: "ready", prepError: null, preparedAt: new Date() } },
    { new: true, lean: true }
  )
  return record ? toDetail(record as unknown as StoredPlan) : null
}

/**
 * Records that a run didn't finish. Any preparation already saved stays exactly as it was.
 */
export async function failPrep(id: string, message: string): Promise<void> {
  await connectDatabase()
  await MeetingPlanModel.updateOne({ _id: id }, { $set: { prepStatus: "failed", prepError: message } })
}
