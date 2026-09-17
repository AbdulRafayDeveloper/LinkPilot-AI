import { connectDatabase } from "@/lib/db"
import { allOf, createdBetween, olderThanCursor, searchCondition, toCursor } from "@/lib/listQuery"
import { LoginEventModel, type ILoginEvent } from "@/models/LoginEvent"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import { ACTIVE_DAYS, type LoginEventType } from "@/constants/admin"
import type { AuditPage, AuditSummary, LoginEventEntry } from "@/types/admin"

/**
 * The audit log for Audit Management: every sign-in, sign-up, sign-out and refused attempt, newest
 * first, 50 at a time, searched and filtered in the database. Admin-only; the routes check.
 */

type StoredEvent = ILoginEvent & { _id: { toString: () => string } }

export const toLoginEventEntry = (record: StoredEvent): LoginEventEntry => ({
  id: record._id.toString(),
  createdAt: new Date(record.createdAt).toISOString(),
  event: record.event,
  userId: record.userId ?? null,
  email: record.email,
  name: record.name ?? null,
  browser: record.browser,
  os: record.os,
  device: record.device,
  ipAddress: record.ipAddress ?? null,
  performedBy: record.performedBy ?? null,
})

const DAY_MS = 24 * 60 * 60 * 1000

async function summarize(): Promise<AuditSummary> {
  const dayAgo = new Date(Date.now() - DAY_MS)
  const [signIns24h, failed24h, activeUsers, totalEvents] = await Promise.all([
    LoginEventModel.countDocuments({ event: { $in: ["sign-in", "sign-up"] }, createdAt: { $gte: dayAgo } }),
    LoginEventModel.countDocuments({ event: { $in: ["failed", "locked"] }, createdAt: { $gte: dayAgo } }),
    LoginEventModel.distinct("userId", { event: { $in: ["sign-in", "sign-up"] }, createdAt: { $gte: new Date(Date.now() - ACTIVE_DAYS * DAY_MS) } }),
    LoginEventModel.estimatedDocumentCount(),
  ])
  return { signIns24h, failed24h, activeUsers7d: activeUsers.filter(Boolean).length, totalEvents }
}

export interface AuditFilters {
  cursor: string | null
  search: string
  event: LoginEventType | ""
  userId: string
  from: string | null
  to: string | null
}

export async function listLoginEvents(filters: AuditFilters): Promise<AuditPage> {
  await connectDatabase()
  const matching = allOf([
    searchCondition(filters.search, ["email", "name", "ipAddress", "browser", "os"]),
    filters.event ? { event: filters.event } : null,
    filters.userId ? { userId: filters.userId } : null,
    createdBetween(filters.from, filters.to),
  ])
  const [rows, total, summary] = await Promise.all([
    LoginEventModel.find(allOf([matching, olderThanCursor(filters.cursor)]))
      .sort({ createdAt: -1, _id: -1 })
      .limit(HISTORY_PAGE_SIZE + 1)
      .lean(),
    LoginEventModel.countDocuments(matching),
    // The summary cards only need filling once, with the first batch
    filters.cursor ? Promise.resolve(null) : summarize(),
  ])
  const stored = rows as unknown as StoredEvent[]
  const batch = stored.slice(0, HISTORY_PAGE_SIZE)
  return {
    items: batch.map(toLoginEventEntry),
    nextCursor: stored.length > HISTORY_PAGE_SIZE && batch.length > 0 ? toCursor(batch[batch.length - 1]) : null,
    total,
    summary,
  }
}
