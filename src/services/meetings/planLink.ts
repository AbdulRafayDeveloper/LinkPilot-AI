import { connectDatabase } from "@/lib/db"
import { Meeting } from "@/models/Meeting"
import { MeetingPlan } from "@/models/MeetingPlan"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { MAX_LINKED_AT_ONCE, MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { UserFacingError } from "@/lib/errors"
import type { LinkedMeeting, MeetingPlanRef } from "@/types/meetings"
import type { Viewer } from "@/types/auth"

/**
 * The link between a meeting that happened (`meetings`: its notes, its recording) and the planned
 * meeting it was (`meeting_plans`: the calendar in Meeting Planner).
 *
 * It is **one nullable field on the record** (`planId` on the meeting), not a join table: a record
 * belongs to at most one planned meeting, while a planned meeting may hold several, since a call
 * that ran over two sittings is two records of one event. Every meeting saved before this reads as
 * linked to nothing, and neither module behaves differently until a link is made.
 *
 * Both sides are scoped to the viewer (`visibleTo`, `visibleById`), so a link can only ever be made
 * between a meeting and a planned meeting the same account may see, and a planned meeting that is
 * gone or another account's is refused rather than written.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

type StoredPlan = { _id: { toString: () => string }; name: string; meetingDate: string; meetingTime: string }

const toRef = (record: StoredPlan): MeetingPlanRef => ({
  id: record._id.toString(),
  name: record.name,
  meetingDate: record.meetingDate,
  meetingTime: record.meetingTime,
})

/**
 * Links several meetings to one planned meeting, or unlinks them when `planId` is null. Answers how
 * many records changed, so the page can say it rather than guess.
 *
 * The ids are held to what the viewer may see, so an id belonging to another account changes
 * nothing, and the planned meeting is read first: linking to one that is gone is refused outright
 * rather than leaving the records pointing at nothing.
 */
export async function linkMeetingsToPlan(viewer: Viewer, meetingIds: readonly string[], planId: string | null): Promise<{ changed: number; plan: MeetingPlanRef | null }> {
  const ids = [...new Set(meetingIds.filter((id) => ID_PATTERN.test(id)))]
  if (ids.length === 0) return { changed: 0, plan: null }
  if (ids.length > MAX_LINKED_AT_ONCE) throw new UserFacingError(MEETING_PLAN_LINK_MESSAGES.tooMany)
  await connectDatabase()

  let plan: MeetingPlanRef | null = null
  if (planId) {
    const filter = visibleById(viewer, planId)
    if (!filter) throw new UserFacingError(MEETING_PLAN_LINK_MESSAGES.linkFailed)
    const record = (await MeetingPlan.findOne(filter, { name: 1, meetingDate: 1, meetingTime: 1 }).lean()) as unknown as StoredPlan | null
    if (!record) throw new UserFacingError(MEETING_PLAN_LINK_MESSAGES.linkFailed)
    plan = toRef(record)
  }

  const { modifiedCount } = await Meeting.updateMany({ ...visibleTo(viewer), _id: { $in: ids } }, { $set: { planId: planId ?? null } })
  return { changed: modifiedCount, plan }
}

/** The planned meeting each of these meetings is linked to, for naming it in a list. */
export async function plansOfMeetings(viewer: Viewer, planIds: readonly (string | null | undefined)[]): Promise<Map<string, MeetingPlanRef>> {
  const ids = [...new Set(planIds.filter((id): id is string => Boolean(id) && ID_PATTERN.test(id as string)))]
  if (ids.length === 0) return new Map()
  await connectDatabase()
  const records = (await MeetingPlan.find({ ...visibleTo(viewer), _id: { $in: ids } }, { name: 1, meetingDate: 1, meetingTime: 1 }).lean()) as unknown as StoredPlan[]
  return new Map(records.map((record) => [record._id.toString(), toRef(record)]))
}

/**
 * Every record linked to one planned meeting, newest first: what the calendar's popup lists. A
 * planned meeting that is gone or another account's answers null, so the popup says nothing rather
 * than showing another account's notes.
 */
export async function meetingsOfPlan(viewer: Viewer, planId: string): Promise<LinkedMeeting[] | null> {
  const filter = visibleById(viewer, planId)
  if (!filter) return null
  await connectDatabase()
  if (!(await MeetingPlan.exists(filter))) return null
  const records = (await Meeting.find(
    { ...visibleTo(viewer), planId },
    { title: 1, status: 1, recording: 1, transcriptChars: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1, _id: -1 })
    .lean()) as unknown as {
    _id: { toString: () => string }
    title: string
    status: string
    recording: unknown
    transcriptChars: number
    createdAt: Date
  }[]
  return records.map((record) => ({
    id: record._id.toString(),
    title: record.title,
    status: record.status,
    // What it is, so the popup says "recording" where there is one and "notes" where there is not
    hasRecording: Boolean(record.recording),
    transcriptChars: record.transcriptChars ?? 0,
    createdAt: new Date(record.createdAt).toISOString(),
  }))
}

/**
 * How many records are linked to each of these planned meetings, for the calendar and the day list.
 * One grouped read for the whole month, never one per meeting.
 */
export async function linkedCounts(viewer: Viewer, planIds: readonly string[]): Promise<Map<string, number>> {
  const ids = [...new Set(planIds.filter((id) => ID_PATTERN.test(id)))]
  if (ids.length === 0) return new Map()
  await connectDatabase()
  const rows = await Meeting.aggregate<{ _id: string; count: number }>([
    { $match: { ...visibleTo(viewer), planId: { $in: ids } } },
    { $group: { _id: "$planId", count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.count]))
}

/**
 * Takes a planned meeting out of the records that point at it, for a meeting being deleted. Nothing
 * of the record goes: its notes and its recording are work of their own, exactly as deleting a
 * folder keeps what was filed in it.
 */
export async function forgetPlan(viewer: Viewer, planIds: readonly string[]): Promise<number> {
  const ids = [...new Set(planIds.filter((id) => ID_PATTERN.test(id)))]
  if (ids.length === 0) return 0
  await connectDatabase()
  const { modifiedCount } = await Meeting.updateMany({ ...visibleTo(viewer), planId: { $in: ids } }, { $set: { planId: null } })
  return modifiedCount
}
