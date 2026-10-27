import type { NextRequest } from "next/server"
import { connectDatabase } from "@/lib/db"
import { describeUserAgent } from "@/lib/userAgent"
import { LoginEventModel } from "@/models/LoginEvent"
import { USER_AGENT_MAX_LENGTH, type LoginEventType } from "@/constants/admin"
import { recordActivity } from "@/services/activityLogs/record"
import type { ActivityAction } from "@/constants/activityLogs"

/**
 * Writes the audit trail Audit Management reads. A failure to write is logged and swallowed: an
 * audit problem must never stop someone signing in or out.
 */

export interface ClientInfo {
  userAgent: string
  ipAddress: string | null
}

/** The device and address a request came from. Behind Vercel the first forwarded address is the visitor's. */
export function clientInfo(req: NextRequest): ClientInfo {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return {
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, USER_AGENT_MAX_LENGTH),
    ipAddress: forwarded || req.headers.get("x-real-ip") || null,
  }
}

export async function recordLoginEvent(
  event: LoginEventType,
  who: { userId: string | null; email: string; name: string | null },
  client: ClientInfo,
  performedBy: string | null = null
): Promise<void> {
  try {
    await connectDatabase()
    const { browser, os, device } = describeUserAgent(client.userAgent)
    await LoginEventModel.create({ ...who, event, browser, os, device, userAgent: client.userAgent, ipAddress: client.ipAddress, performedBy })
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't write the audit event:", event, error instanceof Error ? error.message : error)
  }
  // The account's own sign-ins, sign-outs and password changes are its activities too, so its log
  // tells the whole story. An event an admin caused (a deletion) is the admin's activity, not this one
  const action = ACCOUNT_ACTIONS[event]
  if (who.userId && action) {
    await recordActivity({
      userId: who.userId,
      action,
      outcome: event === "failed" || event === "locked" ? "refused" : "allowed",
      module: "account",
      resource: "",
      method: "",
      path: "",
      targetId: null,
      userAgent: client.userAgent,
      ipAddress: client.ipAddress,
    })
  }
}

// Each audit event as the activity it is in the account's own log; a deletion is not one of them
const ACCOUNT_ACTIONS: Partial<Record<LoginEventType, ActivityAction>> = {
  "sign-in": "sign-in",
  "sign-up": "sign-up",
  "sign-out": "sign-out",
  failed: "failed-sign-in",
  locked: "locked",
  "password-changed": "password-changed",
}
