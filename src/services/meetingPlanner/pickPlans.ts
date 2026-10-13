import type { PipelineStage } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { MeetingPlan as MeetingPlanModel, type IMeetingPlan } from "@/models/MeetingPlan"
import { visibleTo } from "@/services/auth/viewer"
import { linkedCounts } from "@/services/meetings/planLink"
import { PLAN_PICK_PAGE_SIZE, type PlanPickRepeat, type PlanPickWhen } from "@/constants/meetings"
import { recurrenceLabel } from "@/constants/meetingPlanner"
import type { PlanPickGroup, PlanPickOccurrence, PlanPickPage } from "@/types/meetings"
import type { Viewer } from "@/types/auth"

/**
 * The calendar as something to **pick one meeting out of**, for linking a record (notes, a
 * recording) to the meeting it was. It is a different read from the calendar's own month query, and
 * it exists because a repeating meeting is stored as one meeting per day it happens: the picker
 * listed "Adsoda Weekly Meeting" five times over, which is both messy and hard to choose from.
 *
 * Two rules do the work:
 *
 * 1. **One row per meeting, not per date.** The rows are grouped by `seriesId`, so a repeating
 *    meeting is one row saying how many dates it holds and when they run from and to; its dates are
 *    read only when that row is opened (`listPlanOccurrences`). A meeting that does not repeat is a
 *    group of one and is linked without opening anything.
 * 2. **Nearest to today first**, past or upcoming. A record is nearly always of a meeting that has
 *    just been held, but writing one up before it happens is ordinary too, so neither direction is
 *    preferred: the row whose date is closest to today, whichever side of it, is at the top.
 *
 * The filters (`when`, `repeat`) and the search narrow what is grouped **in the database**, so the
 * paging is over the whole calendar rather than over a window of it.
 */

type StoredPlan = IMeetingPlan & { _id: { toString: () => string } }

export interface PickFilters {
  search: string
  when: PlanPickWhen
  repeat: PlanPickRepeat
  page: number
  // The browser's own day, so "past" and "upcoming" are the user's, not the server's
  today: string
}

const escapeText = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * What the filters leave, as a plain query: the viewer's own meetings, narrowed by when they are,
 * whether they repeat and what was typed. `visibleTo` is a single field, so `$or` here is safe.
 */
function narrowing(viewer: Viewer, { search, when, repeat, today }: Omit<PickFilters, "page">): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...visibleTo(viewer) }
  if (when === "past") filter.meetingDate = { $lt: today }
  if (when === "upcoming") filter.meetingDate = { $gte: today }
  // A meeting saved before series existed has no field at all, which `$in: [null]` matches too
  if (repeat === "repeating") filter.seriesId = { $type: "string" }
  if (repeat === "single") filter.seriesId = { $in: [null] }
  const typed = search.trim()
  if (typed) {
    const pattern = new RegExp(escapeText(typed), "i")
    filter.$or = [{ name: pattern }, { personName: pattern }]
  }
  return filter
}

/** A page past the end comes back as the last page, the rule every list here follows. */
const pageOf = (page: number, total: number) => {
  const pages = Math.max(1, Math.ceil(total / PLAN_PICK_PAGE_SIZE))
  return { page: Math.min(Math.max(1, page), pages), pages }
}

/** How many records already point at each of these meetings, in one grouped read for the page. */
async function withLinked<T extends { linkedCount: number }>(viewer: Viewer, rows: T[], idOf: (row: T) => string): Promise<T[]> {
  const counts = await linkedCounts(viewer, rows.map(idOf))
  return rows.map((row) => ({ ...row, linkedCount: counts.get(idOf(row)) ?? 0 }))
}

interface GroupRow {
  _id: string
  seriesId: string | null
  name: string
  personName: string | null
  pattern: string | null
  count: number
  firstDate: string
  lastDate: string
  meetingId: string
  meetingDate: string
  meetingTime: string
  status: string
}

/**
 * The grouping itself, up to the point where it is counted or paged. The nearest date of a group is
 * what its row shows, so the sort **before** the grouping is what decides which date `$first` takes.
 */
const grouping = (match: Record<string, unknown>, today: string): PipelineStage[] => [
  { $match: match },
  { $addFields: { gap: { $abs: { $dateDiff: { startDate: { $toDate: "$meetingDate" }, endDate: { $toDate: today }, unit: "day" } } } } },
  { $sort: { gap: 1, meetingDate: -1, _id: 1 } },
  {
    $group: {
      _id: { $ifNull: ["$seriesId", { $toString: "$_id" }] },
      seriesId: { $first: "$seriesId" },
      name: { $first: "$name" },
      personName: { $first: "$personName" },
      pattern: { $first: "$recurrencePattern" },
      count: { $sum: 1 },
      firstDate: { $min: "$meetingDate" },
      lastDate: { $max: "$meetingDate" },
      meetingId: { $first: { $toString: "$_id" } },
      meetingDate: { $first: "$meetingDate" },
      meetingTime: { $first: "$meetingTime" },
      status: { $first: "$status" },
      gap: { $min: "$gap" },
    },
  },
]

/**
 * One page of the picker: every meeting the filters leave, grouped by series, nearest to today
 * first. It is counted first and read second, so the page can be clamped to what there is without
 * the pipeline being written twice.
 */
export async function listPlanGroups(viewer: Viewer, filters: PickFilters): Promise<PlanPickPage<PlanPickGroup>> {
  await connectDatabase()
  const { search, when, repeat, today } = filters
  const stages = grouping(narrowing(viewer, { search, when, repeat, today }), today)

  const [counted] = await MeetingPlanModel.aggregate<{ n: number }>([...stages, { $count: "n" }])
  const total = counted?.n ?? 0
  const { page, pages } = pageOf(filters.page, total)
  const rows = total
    ? await MeetingPlanModel.aggregate<GroupRow>([
        ...stages,
        { $sort: { gap: 1, lastDate: -1, _id: 1 } },
        { $skip: (page - 1) * PLAN_PICK_PAGE_SIZE },
        { $limit: PLAN_PICK_PAGE_SIZE },
      ])
    : []

  const groups: PlanPickGroup[] = rows.map((row) => ({
    key: row._id,
    seriesId: row.seriesId ?? null,
    name: row.name,
    personName: row.personName ?? null,
    // Named in the owner's own words ("Every week"), never by the id stored on the meeting
    pattern: row.seriesId ? recurrenceLabel(row.pattern) : null,
    count: row.count,
    firstDate: row.firstDate,
    lastDate: row.lastDate,
    meetingId: row.meetingId,
    meetingDate: row.meetingDate,
    meetingTime: row.meetingTime,
    status: row.status,
    linkedCount: 0,
  }))
  return { rows: await withLinked(viewer, groups, (group) => group.meetingId), page, pages, total }
}

/**
 * The dates of one repeating meeting, newest first, inside the row that was opened. The `when`
 * filter is kept, so a picker narrowed to past meetings opens a series on its past dates only; the
 * search is left out, because every date of a series carries the same name.
 */
export async function listPlanOccurrences(
  viewer: Viewer,
  seriesId: string,
  filters: Omit<PickFilters, "search" | "repeat">
): Promise<PlanPickPage<PlanPickOccurrence>> {
  await connectDatabase()
  const match = { ...narrowing(viewer, { ...filters, search: "", repeat: "all" }), seriesId }
  const total = await MeetingPlanModel.countDocuments(match)
  const { page, pages } = pageOf(filters.page, total)
  const records = (await MeetingPlanModel.find(match, "meetingDate meetingTime status")
    .sort({ meetingDate: -1, meetingTime: -1, _id: 1 })
    .skip((page - 1) * PLAN_PICK_PAGE_SIZE)
    .limit(PLAN_PICK_PAGE_SIZE)
    .lean()) as unknown as StoredPlan[]

  const rows: PlanPickOccurrence[] = records.map((record) => ({
    id: record._id.toString(),
    meetingDate: record.meetingDate,
    meetingTime: record.meetingTime,
    status: record.status,
    linkedCount: 0,
  }))
  return { rows: await withLinked(viewer, rows, (row) => row.id), page, pages, total }
}
