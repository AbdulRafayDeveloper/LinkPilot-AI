import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { decoyPasswordHash, hashPassword, verifyPassword } from "@/lib/passwords"
import { UserModel } from "@/models/User"
import { AUTH_MESSAGES, LOGIN_LOCK_MINUTES, MAX_FAILED_LOGINS } from "@/constants/auth"
import type { LoginInput, SignupInput, Viewer } from "@/types/auth"
import { recordLoginEvent, type ClientInfo } from "./audit"

/**
 * Signing in and creating accounts. Admins are never created here: sign-up makes a `user`, and an
 * admin comes only from scripts/create-admin.mjs, run by someone with the database credentials.
 */

type SignedIn = { viewer: Viewer; sessionVersion: number }

const toViewer = (user: { _id: unknown; email: string; name: string; role: Viewer["role"] }): Viewer => ({
  id: String(user._id),
  email: user.email,
  name: user.name,
  role: user.role,
})

/**
 * Checks an email and password. Every failure reads the same, whether the email is unknown or the
 * password wrong, and takes as long, so the form can't be used to find out who has an account.
 * Wrong passwords in a row lock the account for a while. Every outcome goes to the audit trail.
 */
export async function signIn({ email, password }: LoginInput, client: ClientInfo): Promise<SignedIn> {
  await connectDatabase()
  const typed = email.toLowerCase()
  const user = await UserModel.findOne({ email: typed })
  if (!user) {
    await verifyPassword(password, await decoyPasswordHash())
    await recordLoginEvent("failed", { userId: null, email: typed, name: null }, client)
    throw new UserFacingError(AUTH_MESSAGES.badCredentials)
  }
  const who = { userId: String(user._id), email: user.email, name: user.name }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordLoginEvent("locked", who, client)
    throw new UserFacingError(AUTH_MESSAGES.locked)
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failedLogins = user.failedLogins + 1
    const lock = failedLogins >= MAX_FAILED_LOGINS
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: { failedLogins: lock ? 0 : failedLogins, lockedUntil: lock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) : null },
        $inc: { failedLoginCount: 1 },
      }
    )
    await recordLoginEvent(lock ? "locked" : "failed", who, client)
    throw new UserFacingError(lock ? AUTH_MESSAGES.locked : AUTH_MESSAGES.badCredentials)
  }

  await UserModel.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }, $inc: { loginCount: 1 } })
  await recordLoginEvent("sign-in", who, client)
  return { viewer: toViewer(user), sessionVersion: user.sessionVersion }
}

/** Creates a `user` account and signs it in. An email already in use is refused. */
export async function signUp({ name, email, password }: SignupInput, client: ClientInfo): Promise<SignedIn> {
  await connectDatabase()
  const passwordHash = await hashPassword(password)
  try {
    // Signing up signs the account in, so it counts as the first sign-in
    const user = await UserModel.create({ name, email: email.toLowerCase(), passwordHash, role: "user", lastLoginAt: new Date(), loginCount: 1 })
    await recordLoginEvent("sign-up", { userId: String(user._id), email: user.email, name: user.name }, client)
    return { viewer: toViewer(user), sessionVersion: user.sessionVersion }
  } catch (error: unknown) {
    // The unique index is what decides, so two sign-ups racing for one email can't both succeed
    if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new UserFacingError(AUTH_MESSAGES.emailTaken)
    throw error
  }
}

/** Names for a set of account ids, for showing an admin whose record is whose. */
export async function accountNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => /^[0-9a-f]{24}$/.test(id)))]
  if (unique.length === 0) return new Map()
  await connectDatabase()
  const users = await UserModel.find({ _id: { $in: unique } }, { name: 1 }).lean()
  return new Map(users.map((user) => [String(user._id), user.name]))
}
