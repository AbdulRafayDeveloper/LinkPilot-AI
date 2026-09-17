import { connectDatabase } from "@/lib/db"
import { allOf, olderThanCursor, searchCondition, toCursor } from "@/lib/listQuery"
import { LoginEventModel, type ILoginEvent } from "@/models/LoginEvent"
import { UserModel, type IUser } from "@/models/User"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { ACTIVE_DAYS, RECENT_LOGINS_SHOWN } from "@/constants/admin"
import type { UserRole } from "@/constants/auth"
import type { AdminUser, DeviceSummary, UserActivity, UsersPage, UsersSummary } from "@/types/admin"
import { usageByAccount } from "./activity"
import { toLoginEventEntry } from "./audit"

/**
 * User Management: every account with its sign-in counts, the device it last signed in from and
 * how much it has made, plus one account's tool-by-tool breakdown. Admin-only; the routes check.
 * The password hash and session version are never read out of the collection.
 */

const SAFE_FIELDS = { passwordHash: 0, sessionVersion: 0 } as const
const DAY_MS = 24 * 60 * 60 * 1000

type StoredUser = Omit<IUser, "passwordHash" | "sessionVersion"> & { _id: { toString: () => string } }

// The device of each account's latest successful sign-in, in one query for the whole batch
async function lastDevices(ids: string[]): Promise<Map<string, DeviceSummary>> {
  const rows = await LoginEventModel.aggregate<{ _id: string; browser: string; os: string; device: string }>([
    { $match: { userId: { $in: ids }, event: { $in: ["sign-in", "sign-up"] } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$userId", browser: { $first: "$browser" }, os: { $first: "$os" }, device: { $first: "$device" } } },
  ])
  return new Map(rows.map((row) => [row._id, { browser: row.browser, os: row.os, device: row.device }]))
}

async function toAdminUsers(records: StoredUser[]) {
  const ids = records.map((record) => record._id.toString())
  const [usage, devices] = await Promise.all([usageByAccount(ids), lastDevices(ids)])
  const users = records.map((record): AdminUser => {
    const id = record._id.toString()
    const tools = usage.get(id) ?? []
    const lastUsed = tools.map((tool) => tool.lastUsedAt).filter((time): time is string => time !== null).sort().at(-1) ?? null
    return {
      id,
      name: record.name,
      email: record.email,
      role: record.role,
      createdAt: new Date(record.createdAt).toISOString(),
      lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt).toISOString() : null,
      // Accounts made before the counters existed read as zero rather than missing
      loginCount: record.loginCount ?? 0,
      failedLoginCount: record.failedLoginCount ?? 0,
      isLocked: Boolean(record.lockedUntil && new Date(record.lockedUntil).getTime() > Date.now()),
      recordCount: tools.reduce((sum, tool) => sum + tool.count, 0),
      lastActivityAt: lastUsed,
      lastDevice: devices.get(id) ?? null,
    }
  })
  return { users, usage }
}

async function summarize(): Promise<UsersSummary> {
  const [totalUsers, admins, active7d, new30d] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ role: "admin" }),
    UserModel.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - ACTIVE_DAYS * DAY_MS) } }),
    UserModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * DAY_MS) } }),
  ])
  return { totalUsers, admins, users: totalUsers - admins, active7d, new30d }
}

/** One batch of accounts, newest first, searched by name or email and filtered by role. */
export async function listUsers(filters: { cursor: string | null; search: string; role: UserRole | "" }): Promise<UsersPage> {
  await connectDatabase()
  const matching = allOf([searchCondition(filters.search, ["name", "email"]), filters.role ? { role: filters.role } : null])
  const [rows, total, summary] = await Promise.all([
    UserModel.find(allOf([matching, olderThanCursor(filters.cursor)]), SAFE_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(HISTORY_PAGE_SIZE + 1)
      .lean(),
    UserModel.countDocuments(matching),
    filters.cursor ? Promise.resolve(null) : summarize(),
  ])
  const stored = rows as unknown as StoredUser[]
  const batch = stored.slice(0, HISTORY_PAGE_SIZE)
  const { users } = await toAdminUsers(batch)
  return {
    items: users,
    nextCursor: stored.length > HISTORY_PAGE_SIZE && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
    summary,
  }
}

/** One account in detail: what it made in each tool (busiest first) and its latest sign-in events. */
export async function getUserActivity(id: string): Promise<UserActivity | null> {
  if (!/^[0-9a-f]{24}$/.test(id)) return null
  await connectDatabase()
  const record = (await UserModel.findById(id, SAFE_FIELDS).lean()) as unknown as StoredUser | null
  if (!record) return null
  const [{ users, usage }, logins] = await Promise.all([
    toAdminUsers([record]),
    LoginEventModel.find({ userId: id }).sort({ createdAt: -1, _id: -1 }).limit(RECENT_LOGINS_SHOWN).lean(),
  ])
  const tools = [...(usage.get(id) ?? [])].sort((a, b) => b.count - a.count || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))
  return {
    user: users[0],
    tools,
    recentLogins: (logins as unknown as (ILoginEvent & { _id: { toString: () => string } })[]).map(toLoginEventEntry),
  }
}
