import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { env } from "@/config/env"
import { connectDatabase } from "@/lib/db"
import { toUserFacingMessage } from "@/lib/errors"
import { SESSION_COOKIE, SESSION_MS, readSession, signSession } from "@/lib/sessionToken"
import { UserModel } from "@/models/User"
import { AUTH_MESSAGES, AUTH_REQUIRED_HEADER, REQUEST_PATH_HEADER, type UserRole } from "@/constants/auth"
import { FEATURE_ACCESS_MESSAGES } from "@/constants/featureAccess"
import { isFeatureDisabled, toolIdForApiPath } from "@/lib/featureAccess"
import type { Viewer } from "@/types/auth"

/**
 * Who is making a request, and what they may see. Every API route starts with requireViewer, so
 * no route trusts the proxy alone: the account is loaded on each request, and a deleted account,
 * a changed role or an ended session takes effect at once.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

/** The signed-in account, or null when there is none or its session has ended. */
export async function getViewer(): Promise<Viewer | null> {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, env.AUTH_SECRET)
  if (!session) return null
  await connectDatabase()
  const user = await UserModel.findById(session.uid, { email: 1, name: 1, role: 1, sessionVersion: 1, disabledTools: 1 }).lean()
  if (!user || user.sessionVersion !== session.ver) return null
  // An admin keeps every tool, whatever is stored, so nobody can be locked out of the admin area
  const disabledTools = user.role === "admin" ? [] : (user.disabledTools ?? [])
  return { id: String(user._id), email: user.email, name: user.name, role: user.role, disabledTools }
}

type Guard = { viewer: Viewer; denied: null } | { viewer: null; denied: NextResponse }

/**
 * Guard for API routes: the signed-in account, or the response to send instead. `role: "admin"`
 * also refuses users. The "sign in first" answer carries AUTH_REQUIRED_HEADER so the browser sends
 * the person to the sign-in page rather than showing an error.
 *
 * **It also refuses a tool the admin has turned off for this account**, which is what makes hiding
 * it from the sidebar more than a suggestion. Which tool a route belongs to is read from the path
 * the proxy passed along, so a new route under a tool is covered without naming itself; `feature`
 * names it outright where a route's path does not say (and `feature: null` opts out).
 */
export async function requireViewer(options: { role?: UserRole; feature?: string | null } = {}): Promise<Guard> {
  let viewer: Viewer | null
  try {
    viewer = await getViewer()
  } catch (error: unknown) {
    // The account couldn't be read (the database is down): say so instead of letting the route crash
    console.error("Viewer Lookup Exception:", error instanceof Error ? error.message : error)
    const denied = NextResponse.json({ success: false, message: toUserFacingMessage(error, AUTH_MESSAGES.signInFailed) }, { status: 503 })
    return { viewer: null, denied }
  }
  if (!viewer) {
    const denied = NextResponse.json({ success: false, message: AUTH_MESSAGES.signInRequired }, { status: 401 })
    denied.headers.set(AUTH_REQUIRED_HEADER, "required")
    return { viewer: null, denied }
  }
  if (options.role === "admin" && viewer.role !== "admin") {
    return { viewer: null, denied: NextResponse.json({ success: false, message: AUTH_MESSAGES.adminOnly }, { status: 403 }) }
  }
  if (await isDeniedFeature(viewer, options)) {
    return { viewer: null, denied: NextResponse.json({ success: false, message: FEATURE_ACCESS_MESSAGES.unavailable }, { status: 403 }) }
  }
  return { viewer, denied: null }
}

/** Whether this request is for a tool this account may not use. An admin is never refused. */
async function isDeniedFeature(viewer: Viewer, options: { feature?: string | null }): Promise<boolean> {
  if (viewer.role === "admin" || viewer.disabledTools.length === 0) return false
  if (options.feature !== undefined) return isFeatureDisabled(viewer, options.feature)
  const path = (await headers()).get(REQUEST_PATH_HEADER)
  return isFeatureDisabled(viewer, path ? toolIdForApiPath(path) : null)
}

/** Starts a session for an account, in an httpOnly cookie this browser sends back on every request. */
export async function startSession(user: { id: string; sessionVersion: number }, isSecure: boolean): Promise<void> {
  const exp = Date.now() + SESSION_MS
  ;(await cookies()).set(SESSION_COOKIE, signSession({ uid: user.id, ver: user.sessionVersion, exp }, env.AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    expires: new Date(exp),
  })
}

export async function endSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}

/**
 * What a viewer may read: an admin sees every record, including those saved before accounts
 * existed; a user sees only their own.
 */
export const visibleTo = (viewer: Viewer): Record<string, unknown> => (viewer.role === "admin" ? {} : { ownerId: viewer.id })

/**
 * What a bulk action (Clear All, a cleanup) may touch: the viewer's own records, and for an admin
 * also the records from before accounts existed. An admin can still delete anyone's record one at a time.
 */
export const ownedBy = (viewer: Viewer): Record<string, unknown> =>
  viewer.role === "admin" ? { ownerId: { $in: [viewer.id, null] } } : { ownerId: viewer.id }

/** One record by id, if the viewer may see it. An id that isn't one never matches. */
export const visibleById = (viewer: Viewer, id: string): Record<string, unknown> | null =>
  ID_PATTERN.test(id) ? { _id: id, ...visibleTo(viewer) } : null
