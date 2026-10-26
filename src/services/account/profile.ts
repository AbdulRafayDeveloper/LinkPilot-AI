import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { hashPassword, verifyPassword } from "@/lib/passwords"
import { UserModel } from "@/models/User"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { recordLoginEvent, type ClientInfo } from "@/services/auth/audit"
import type { ChangePasswordInput } from "@/lib/validation/account"
import type { Viewer } from "@/types/auth"

/**
 * What an account may change about itself: its name and its password. Everything here is scoped by
 * `viewer.id`, never `dataOwnerId` — this is the person, not the workspace — so a child account
 * changes its own name and its own password and never its parent's.
 */

/**
 * The account's own name (what the header and the account menu show), its timezone, or both, **each written only when it is sent**, so saving the
 * timezone never carries a stale name over one saved from another tab. A null timezone goes back to
 * following the browser. Answers both as they are now.
 */
export async function updateAccountProfile(
  viewer: Viewer,
  change: { name?: string; timeZone?: string | null }
): Promise<{ name: string; timeZone: string | null }> {
  await connectDatabase()
  const set: Record<string, unknown> = {}
  if (change.name !== undefined) set.name = change.name
  if (change.timeZone !== undefined) set.timeZone = change.timeZone
  const saved = await UserModel.findOneAndUpdate({ _id: viewer.id }, { $set: set }, { new: true, projection: { name: 1, timeZone: 1 } }).lean()
  if (!saved) throw new UserFacingError(ACCOUNT_MESSAGES.gone)
  return { name: saved.name, timeZone: saved.timeZone ?? null }
}

/**
 * A new password for this account, after checking the one it signs in with now.
 *
 * Raising `sessionVersion` ends every session the account has, which is the point: a password is
 * changed because somewhere else should stop working. **This browser is signed in again on the way
 * out** (the route re-issues the cookie with the new version), so changing a password never signs
 * the person out of the page they are standing on. It answers the new version for that.
 */
export async function changeAccountPassword(viewer: Viewer, input: ChangePasswordInput, client: ClientInfo): Promise<number> {
  await connectDatabase()
  const account = await UserModel.findById(viewer.id, { passwordHash: 1, sessionVersion: 1, email: 1, name: 1 }).lean()
  if (!account) throw new UserFacingError(ACCOUNT_MESSAGES.gone)
  if (!(await verifyPassword(input.currentPassword, account.passwordHash))) throw new UserFacingError(ACCOUNT_MESSAGES.wrongPassword)
  // The schema already refuses the two being the same word for word; this catches the same password
  // typed differently (a stored hash is the only thing that can say so)
  if (await verifyPassword(input.newPassword, account.passwordHash)) throw new UserFacingError(ACCOUNT_MESSAGES.samePassword)

  const passwordHash = await hashPassword(input.newPassword)
  // The lockout counters go with it: someone who knows the password has no wrong attempts to carry
  const updated = await UserModel.findOneAndUpdate(
    { _id: viewer.id },
    { $set: { passwordHash, failedLogins: 0, lockedUntil: null }, $inc: { sessionVersion: 1 } },
    { new: true, projection: { sessionVersion: 1 } }
  ).lean()
  if (!updated) throw new UserFacingError(ACCOUNT_MESSAGES.gone)
  // Changing a password is worth a line in the audit trail, like a sign-in; it can never fail the change
  await recordLoginEvent("password-changed", { userId: viewer.id, email: account.email, name: account.name }, client)
  return updated.sessionVersion
}
