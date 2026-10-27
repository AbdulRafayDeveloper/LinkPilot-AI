import { after } from "next/server"
import { headers } from "next/headers"
import { connectDatabase } from "@/lib/db"
import { describeUserAgent } from "@/lib/userAgent"
import { describeRequest, isLoggedRequest } from "@/lib/activityLog"
import { ActivityLogModel } from "@/models/ActivityLog"
import { REQUEST_METHOD_HEADER, REQUEST_PATH_HEADER } from "@/constants/auth"
import { USER_AGENT_MAX_LENGTH } from "@/constants/admin"
import { ACTIVITY_MERGE_WINDOW_MS, type ActivityAction, type ActivityOutcome } from "@/constants/activityLogs"

/**
 * Writes the activity log. **A failure to write is logged and swallowed**: keeping a record of an
 * action must never be the reason the action itself fails, the rule the audit trail follows.
 */

export interface ActivityInput {
  userId: string
  action: ActivityAction
  outcome: ActivityOutcome
  module: string
  resource: string
  // Empty for the account events the audit trail hands over (a sign-in has no route of its own here)
  method: string
  path: string
  targetId: string | null
  userAgent: string
  ipAddress: string | null
}

/**
 * Keeps one activity. The same request from the same account inside `ACTIVITY_MERGE_WINDOW_MS` is
 * folded into the activity it repeats (its count goes up and its last time moves on) rather than
 * written again, so an editor that saves itself every second leaves one line, not sixty.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await connectDatabase()
    const now = new Date()
    if (input.method && input.path) {
      const merged = await ActivityLogModel.findOneAndUpdate(
        {
          userId: input.userId,
          method: input.method,
          path: input.path,
          action: input.action,
          outcome: input.outcome,
          deletedAt: null,
          lastAt: { $gte: new Date(now.getTime() - ACTIVITY_MERGE_WINDOW_MS) },
        },
        { $inc: { count: 1 }, $set: { lastAt: now } },
        { sort: { lastAt: -1 }, projection: { _id: 1 } }
      ).lean()
      if (merged) return
    }
    const userAgent = input.userAgent.slice(0, USER_AGENT_MAX_LENGTH)
    const { browser, os, device } = describeUserAgent(userAgent)
    await ActivityLogModel.create({ ...input, userAgent, browser, os, device, count: 1, lastAt: now, deletedAt: null })
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't write the activity log:", input.action, input.path, error instanceof Error ? error.message : error)
  }
}

/**
 * Logs the request in front of us as an action of this account, when it is one (a change of some
 * kind, not a read). Called by `requireViewer`, which every API route starts with, so a new route is
 * logged by being written. The write runs after the answer has been sent (`after`), so logging costs
 * the person nothing; outside a request (a test) it simply runs.
 */
export async function logRequestActivity(userId: string, outcome: ActivityOutcome): Promise<void> {
  try {
    const requestHeaders = await headers()
    const method = requestHeaders.get(REQUEST_METHOD_HEADER) ?? ""
    const path = requestHeaders.get(REQUEST_PATH_HEADER) ?? ""
    if (!isLoggedRequest(method, path)) return
    const described = describeRequest(method, path)
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    const write = () =>
      recordActivity({
        userId,
        outcome,
        action: described.action,
        module: described.module,
        resource: described.resource,
        method: method.toUpperCase(),
        path: described.path,
        targetId: described.targetId,
        userAgent: requestHeaders.get("user-agent") ?? "",
        ipAddress: forwarded || requestHeaders.get("x-real-ip") || null,
      })
    try {
      after(write)
    } catch {
      void write()
    }
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't read the request to log it:", error instanceof Error ? error.message : error)
  }
}
