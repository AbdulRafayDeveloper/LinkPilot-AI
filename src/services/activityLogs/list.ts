import { connectDatabase } from "@/lib/db"
import { allOf, createdBetween, escapeForSearch } from "@/lib/listQuery"
import { activityModuleTitle, activitySummary } from "@/lib/activityLog"
import { ActivityLogModel, type IActivityLog } from "@/models/ActivityLog"
import { UserModel } from "@/models/User"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { ACTIVITY_AREAS, OTHER_AREA, type ActivityState } from "@/constants/activityLogs"
import { APP_TOOLS } from "@/constants/linkedinTools"
import type { ActivityQuery, AdminActivityQuery } from "@/lib/validation/activityLogs"
import type { ActivityDeletion, ActivityEntry, ActivityModuleOption, ActivityPage, AdminActivityPage } from "@/types/activityLogs"
import type { Viewer } from "@/types/auth"

/**
 * Reading and deleting the activity log. Every query starts from one account's `userId`, so a person
 * only ever reaches their own activities, and an admin reaches one account's at a time.
 *
 * Two deletes, on purpose: the person's own sets `deletedAt` (the activity leaves their list and the
 * administrators still see it, marked), while an admin's removes the row for good.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/
type StoredActivity = IActivityLog & { _id: { toString: () => string } }

const toEntry = (row: StoredActivity): ActivityEntry => {
  const moduleTitle = activityModuleTitle(row.module)
  return {
    id: row._id.toString(),
    action: row.action,
    outcome: row.outcome,
    module: row.module,
    moduleTitle,
    summary: activitySummary(row, moduleTitle),
    resource: row.resource ?? "",
    method: row.method ?? "",
    path: row.path ?? "",
    targetId: row.targetId ?? null,
    count: row.count ?? 1,
    createdAt: new Date(row.createdAt).toISOString(),
    lastAt: new Date(row.lastAt ?? row.createdAt).toISOString(),
    browser: row.browser ?? "",
    os: row.os ?? "",
    device: row.device ?? "",
    ipAddress: row.ipAddress ?? null,
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
  }
}

// Every module a search could mean by its name, so "daily tasks" finds what was stored as "daily-tasks"
const MODULE_NAMES: { id: string; label: string }[] = [
  ...APP_TOOLS.map((tool) => ({ id: tool.id, label: tool.title })),
  ...ACTIVITY_AREAS.map((area) => ({ id: area.id, label: area.label })),
  OTHER_AREA,
]

/** The search: what was done and to what, the module by its id or its name, the address and the device. */
function searchFor(term: string): Record<string, unknown> | null {
  const text = term.trim()
  if (!text) return null
  const pattern = new RegExp(escapeForSearch(text), "i")
  const modules = MODULE_NAMES.filter((entry) => pattern.test(entry.label)).map((entry) => entry.id)
  return {
    $or: [
      ...["path", "resource", "module", "browser", "os", "device", "ipAddress"].map((field) => ({ [field]: pattern })),
      ...(modules.length > 0 ? [{ module: { $in: modules } }] : []),
    ],
  }
}

const stateCondition = (state: ActivityState | "" | "own"): Record<string, unknown> | null =>
  state === "own" || state === "visible" ? { deletedAt: null } : state === "deleted" ? { deletedAt: { $ne: null } } : null

/** What a list's filters cover, for one account. The list, "delete all matching" and the counts share it. */
function matching(userId: string, query: ActivityQuery, state: ActivityState | "" | "own"): Record<string, unknown> {
  return allOf([
    { userId },
    stateCondition(state),
    searchFor(query.search),
    query.module ? { module: query.module } : null,
    query.action ? { action: query.action } : null,
    query.outcome ? { outcome: query.outcome } : null,
    createdBetween(query.from, query.to),
  ])
}

/** The modules an account's activities are in, by name, for the module filter. */
async function modulesOf(base: Record<string, unknown>): Promise<ActivityModuleOption[]> {
  const ids = (await ActivityLogModel.distinct("module", base)) as string[]
  return ids.map((id) => ({ id, label: activityModuleTitle(id) })).sort((a, b) => a.label.localeCompare(b.label))
}

/** One page of the activities a filter covers, newest first, `HISTORY_PAGE_SIZE` to a page. */
async function pageOf(filter: Record<string, unknown>, base: Record<string, unknown>, requested: number): Promise<ActivityPage> {
  const pageSize = HISTORY_PAGE_SIZE
  const [total, modules] = await Promise.all([ActivityLogModel.countDocuments(filter), modulesOf(base)])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // A page past the end comes back as the last one, so a delete never strands the pager
  const page = Math.min(Math.max(1, requested), totalPages)
  const rows = (await ActivityLogModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()) as unknown as StoredActivity[]
  return { items: rows.map(toEntry), page, pageSize, total, totalPages, modules }
}

/** The signed-in person's own activities, without the ones they deleted. */
export async function listOwnActivities(viewer: Viewer, query: ActivityQuery): Promise<ActivityPage> {
  await connectDatabase()
  return pageOf(matching(viewer.id, query, "own"), { userId: viewer.id, deletedAt: null }, query.page)
}

/**
 * The person deletes their own activities: the picked ones, or every one the filters cover. It is a
 * soft delete, so the rows stay for the administrators; an id that is not theirs matches nothing.
 */
export async function hideActivities(
  viewer: Viewer,
  body: { ids?: string[]; all?: boolean },
  query: ActivityQuery
): Promise<ActivityDeletion> {
  await connectDatabase()
  const filter = body.ids ? { _id: { $in: body.ids }, userId: viewer.id, deletedAt: null } : matching(viewer.id, query, "own")
  const result = await ActivityLogModel.updateMany(filter, { $set: { deletedAt: new Date() } })
  return { deleted: result.modifiedCount }
}

/** One of the person's own activities, deleted the same way. False when it is gone or not theirs. */
export async function hideActivity(viewer: Viewer, id: string): Promise<boolean> {
  if (!ID_PATTERN.test(id)) return false
  await connectDatabase()
  const result = await ActivityLogModel.updateOne({ _id: id, userId: viewer.id, deletedAt: null }, { $set: { deletedAt: new Date() } })
  return result.modifiedCount === 1
}

/** One account's activities for an admin, the deleted ones included and marked. Null when the account is gone. */
export async function listUserActivities(userId: string, query: AdminActivityQuery): Promise<AdminActivityPage | null> {
  if (!ID_PATTERN.test(userId)) return null
  await connectDatabase()
  const user = (await UserModel.findById(userId, { name: 1, email: 1 }).lean()) as { name?: string; email?: string } | null
  if (!user) return null
  const base = { userId }
  const [page, total, deleted, refused, latest] = await Promise.all([
    pageOf(matching(userId, query, query.state), base, query.page),
    ActivityLogModel.countDocuments(base),
    ActivityLogModel.countDocuments({ userId, deletedAt: { $ne: null } }),
    ActivityLogModel.countDocuments({ userId, outcome: "refused" }),
    ActivityLogModel.findOne(base, { lastAt: 1 }).sort({ lastAt: -1 }).lean(),
  ])
  return {
    ...page,
    user: { id: userId, name: user.name ?? "", email: user.email ?? "" },
    summary: { total, deleted, refused, lastAt: latest?.lastAt ? new Date(latest.lastAt).toISOString() : null },
  }
}

/** An admin deletes an account's activities for good: the picked ones, or every one the filters cover. */
export async function purgeActivities(
  userId: string,
  body: { ids?: string[]; all?: boolean },
  query: AdminActivityQuery
): Promise<ActivityDeletion> {
  await connectDatabase()
  const filter = body.ids ? { _id: { $in: body.ids }, userId } : matching(userId, query, query.state)
  const result = await ActivityLogModel.deleteMany(filter)
  return { deleted: result.deletedCount }
}

/** Every activity of an account, removed with the account itself. */
export async function purgeAccountActivities(userId: string): Promise<number> {
  await connectDatabase()
  return (await ActivityLogModel.deleteMany({ userId })).deletedCount
}
