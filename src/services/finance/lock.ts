import { createHash, randomBytes } from "node:crypto"
import { cookies, headers } from "next/headers"
import { env } from "@/config/env"
import { connectDatabase } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/passwords"
import { SESSION_COOKIE, newSessionId, readSession, signSession } from "@/lib/sessionToken"
import { UserModel } from "@/models/User"
import { FinanceUnlockModel } from "@/models/FinanceUnlock"
import {
  FINANCE_IDLE_MINUTES,
  FINANCE_LOCK_COOKIE,
  FINANCE_LOCK_MESSAGES,
  FINANCE_MAX_FAILED,
  FINANCE_MAX_HOURS,
  FINANCE_TOUCH_SECONDS,
  lockoutMinutes,
} from "@/constants/financeLock"
import type { Viewer } from "@/types/auth"

/**
 * The Finance lock's rules (constants/financeLock.ts). Every read and write is the account asking's
 * own, an admin included: the Finance password guards the person's own money, so nobody else sets,
 * changes or skips it for them.
 *
 * An unlock is **a record on the server for one browser and one sign-in** (`finance_unlocks`), found
 * by the SHA-256 of a random token the browser holds in a cookie. Every Finance request checks that
 * record, so ending it (Lock, signing out, Lock on every device, a changed password) takes effect on
 * the very next request, even for someone holding a copy of the cookie.
 */

const IDLE_MS = FINANCE_IDLE_MINUTES * 60 * 1000
const MAX_MS = FINANCE_MAX_HOURS * 60 * 60 * 1000
const TOUCH_MS = FINANCE_TOUCH_SECONDS * 1000
// The cookie is only ever read by the API, so pages and assets never carry it
const COOKIE_PATH = "/api"
const FIELDS = "passwordHash sessionVersion financePasswordHash financePasswordVersion financeFailedAttempts financeLockedUntil financeLockouts"

type StoredLock = {
  passwordHash: string
  sessionVersion: number
  financePasswordHash?: string | null
  financePasswordVersion?: number
  financeFailedAttempts?: number
  financeLockedUntil?: Date | null
  financeLockouts?: number
}

export type LockResult = { ok: true; message: string } | { ok: false; message: string; status: number }

const refuse = (message: string, status = 400): LockResult => ({ ok: false, message, status })
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
const minutesLeft = (until: Date) => Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000))

async function readLock(viewer: Viewer): Promise<StoredLock | null> {
  await connectDatabase()
  return (await UserModel.findById(viewer.id, FIELDS).lean()) as StoredLock | null
}

const unlockToken = async () => (await cookies()).get(FINANCE_LOCK_COOKIE)?.value

/**
 * The id of the sign-in this request belongs to. A session cookie from before sign-ins had ids is
 * given one here, written back to the same cookie, so it can be unlocked like any other.
 */
async function sessionIdOf(viewer: Viewer, isSecure: boolean): Promise<string | null> {
  const jar = await cookies()
  const session = readSession(jar.get(SESSION_COOKIE)?.value, env.AUTH_SECRET)
  if (!session || session.uid !== viewer.id) return null
  if (session.sid) return session.sid
  const sid = newSessionId()
  jar.set(SESSION_COOKIE, signSession({ ...session, sid }, env.AUTH_SECRET), { httpOnly: true, sameSite: "lax", secure: isSecure, path: "/", expires: new Date(session.exp) })
  return sid
}

/**
 * Opens Finance on this browser for this sign-in: a new random token, its hash recorded with the
 * sign-in and both password versions, and the token in a cookie with no expiry date, so closing the
 * browser ends it. Any unlock this browser already had is ended first.
 */
async function openUnlock(viewer: Viewer, stored: StoredLock, passwordVersion: number, isSecure: boolean): Promise<void> {
  const sessionId = await sessionIdOf(viewer, isSecure)
  if (!sessionId) throw new Error("No sign-in to open Finance for")
  await endThisUnlock()
  const token = randomBytes(32).toString("base64url")
  const now = Date.now()
  await FinanceUnlockModel.create({
    ownerId: viewer.id,
    tokenHash: hashToken(token),
    sessionId,
    sessionVersion: stored.sessionVersion,
    passwordVersion,
    idleUntil: new Date(now + IDLE_MS),
    expiresAt: new Date(now + MAX_MS),
    lastUsedAt: new Date(now),
    revokedAt: null,
    device: ((await headers()).get("user-agent") ?? "").slice(0, 200),
  })
  ;(await cookies()).set(FINANCE_LOCK_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isSecure, path: COOKIE_PATH })
}

/**
 * Whether this browser has Finance open for this account and this sign-in now. Every condition must
 * hold: the record exists and is not ended, it is this account's, it was made in this very sign-in,
 * neither password has changed since, and it is inside both its idle window and its last moment.
 */
export async function lockStatus(viewer: Viewer): Promise<{ hasPassword: boolean; unlocked: boolean; unlockId: string | null }> {
  const stored = await readLock(viewer)
  const hasPassword = Boolean(stored?.financePasswordHash)
  const token = await unlockToken()
  if (!stored || !hasPassword || !token) return { hasPassword, unlocked: false, unlockId: null }
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, env.AUTH_SECRET)
  const record = await FinanceUnlockModel.findOne({ tokenHash: hashToken(token), ownerId: viewer.id, revokedAt: null }).lean()
  const now = Date.now()
  const unlocked = Boolean(
    record &&
      session?.sid &&
      session.uid === viewer.id &&
      record.sessionId === session.sid &&
      record.sessionVersion === stored.sessionVersion &&
      record.passwordVersion === (stored.financePasswordVersion ?? 0) &&
      record.idleUntil.getTime() > now &&
      record.expiresAt.getTime() > now
  )
  return { hasPassword, unlocked, unlockId: unlocked && record ? String(record._id) : null }
}

/** Using Finance keeps it open: moves the idle window on, written at most once a minute. */
export async function touchUnlock(unlockId: string): Promise<void> {
  const now = Date.now()
  await FinanceUnlockModel.updateOne(
    { _id: unlockId, revokedAt: null, lastUsedAt: { $lt: new Date(now - TOUCH_MS) } },
    { $set: { lastUsedAt: new Date(now), idleUntil: new Date(now + IDLE_MS) } }
  )
}

/** Ends this browser's unlock, on the server and in the cookie. Harmless when there is none. */
export async function endThisUnlock(): Promise<void> {
  const token = await unlockToken()
  if (token) {
    await connectDatabase()
    await FinanceUnlockModel.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } })
  }
  ;(await cookies()).delete({ name: FINANCE_LOCK_COOKIE, path: COOKIE_PATH })
}

/** Ends Finance on every device this account has it open on. */
export async function endAllUnlocks(viewer: Viewer): Promise<number> {
  await connectDatabase()
  const { modifiedCount } = await FinanceUnlockModel.updateMany({ ownerId: viewer.id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  ;(await cookies()).delete({ name: FINANCE_LOCK_COOKIE, path: COOKIE_PATH })
  return modifiedCount
}

/** Every unlock of an account, for when the account itself is deleted. */
export async function purgeFinanceUnlocks(accountId: string): Promise<void> {
  await connectDatabase()
  await FinanceUnlockModel.deleteMany({ ownerId: accountId })
}

/**
 * Takes one try **before** the password is checked, atomically, and refuses outright while Finance is
 * locked out. Counting first is what stops a burst of guesses sent at the same moment from all being
 * checked before the lockout lands: the sixth of them is refused without its password ever being read.
 */
async function takeAttempt(viewer: Viewer): Promise<{ ok: true; stored: StoredLock } | { ok: false; result: LockResult }> {
  await connectDatabase()
  const now = new Date()
  const stored = (await UserModel.findOneAndUpdate(
    { _id: viewer.id, $or: [{ financeLockedUntil: null }, { financeLockedUntil: { $lte: now } }] },
    { $inc: { financeFailedAttempts: 1 } },
    { new: true, projection: FIELDS }
  ).lean()) as StoredLock | null
  if (!stored) {
    const locked = await readLock(viewer)
    return { ok: false, result: locked?.financeLockedUntil ? refuse(FINANCE_LOCK_MESSAGES.tooMany(minutesLeft(locked.financeLockedUntil)), 429) : refuse(FINANCE_LOCK_MESSAGES.failed, 404) }
  }
  if ((stored.financeFailedAttempts ?? 0) > FINANCE_MAX_FAILED) return { ok: false, result: await lockOut(viewer, stored) }
  return { ok: true, stored }
}

/** Starts a lockout, each one in a row twice as long as the last (`lockoutMinutes`). */
async function lockOut(viewer: Viewer, stored: StoredLock): Promise<LockResult> {
  const minutes = lockoutMinutes(stored.financeLockouts ?? 0)
  await UserModel.updateOne(
    { _id: viewer.id, financeFailedAttempts: { $gte: FINANCE_MAX_FAILED } },
    { $set: { financeFailedAttempts: 0, financeLockedUntil: new Date(Date.now() + minutes * 60_000) }, $inc: { financeLockouts: 1 } }
  )
  return refuse(FINANCE_LOCK_MESSAGES.tooMany(minutes), 429)
}

/** After a try was taken: a wrong password locks out on the last allowed one, a right one clears the count. */
async function settleAttempt(viewer: Viewer, stored: StoredLock, isRight: boolean, wrongMessage: string): Promise<LockResult | null> {
  if (isRight) {
    await UserModel.updateOne({ _id: viewer.id }, { $set: { financeFailedAttempts: 0, financeLockedUntil: null, financeLockouts: 0 } })
    return null
  }
  if ((stored.financeFailedAttempts ?? 0) >= FINANCE_MAX_FAILED) return lockOut(viewer, stored)
  return refuse(wrongMessage)
}

/** The first time: sets the Finance password and opens Finance. Refused once one exists. */
export async function setFinancePassword(viewer: Viewer, password: string, isSecure: boolean): Promise<LockResult> {
  const stored = await readLock(viewer)
  if (!stored) return refuse(FINANCE_LOCK_MESSAGES.failed, 404)
  if (stored.financePasswordHash) return refuse(FINANCE_LOCK_MESSAGES.alreadySet, 409)
  const version = (stored.financePasswordVersion ?? 0) + 1
  // Only set where none is, so two tabs setting one at once cannot both win
  const updated = await UserModel.updateOne(
    { _id: viewer.id, financePasswordHash: null },
    { $set: { financePasswordHash: await hashPassword(password), financePasswordVersion: version, financeFailedAttempts: 0, financeLockedUntil: null, financeLockouts: 0 } }
  )
  if (updated.modifiedCount === 0) return refuse(FINANCE_LOCK_MESSAGES.alreadySet, 409)
  await openUnlock(viewer, stored, version, isSecure)
  return { ok: true, message: FINANCE_LOCK_MESSAGES.set }
}

/** Checks the Finance password, with its own escalating lockout, and opens Finance on this device. */
export async function unlockFinance(viewer: Viewer, password: string, isSecure: boolean): Promise<LockResult> {
  const before = await readLock(viewer)
  if (!before?.financePasswordHash) return refuse(FINANCE_LOCK_MESSAGES.notSet, 409)
  const attempt = await takeAttempt(viewer)
  if (!attempt.ok) return attempt.result
  const { stored } = attempt
  const refused = await settleAttempt(viewer, stored, await verifyPassword(password, stored.financePasswordHash ?? ""), FINANCE_LOCK_MESSAGES.wrong)
  if (refused) return refused
  await openUnlock(viewer, stored, stored.financePasswordVersion ?? 0, isSecure)
  return { ok: true, message: FINANCE_LOCK_MESSAGES.unlocked }
}

/**
 * A new Finance password: its version goes up, so **every device's unlock ends**, and this one is
 * opened again under the new version.
 */
async function replacePassword(viewer: Viewer, stored: StoredLock, password: string, isSecure: boolean): Promise<void> {
  const version = (stored.financePasswordVersion ?? 0) + 1
  await UserModel.updateOne({ _id: viewer.id }, { $set: { financePasswordHash: await hashPassword(password), financePasswordVersion: version } })
  await FinanceUnlockModel.updateMany({ ownerId: viewer.id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  await openUnlock(viewer, stored, version, isSecure)
}

/** Changes the Finance password, given the one in use now (which counts towards the lockout like an unlock). */
export async function changeFinancePassword(viewer: Viewer, current: string, password: string, isSecure: boolean): Promise<LockResult> {
  const before = await readLock(viewer)
  if (!before?.financePasswordHash) return refuse(FINANCE_LOCK_MESSAGES.notSet, 409)
  const attempt = await takeAttempt(viewer)
  if (!attempt.ok) return attempt.result
  const { stored } = attempt
  const refused = await settleAttempt(viewer, stored, await verifyPassword(current, stored.financePasswordHash ?? ""), FINANCE_LOCK_MESSAGES.wrong)
  if (refused) return refused
  if (await verifyPassword(password, stored.financePasswordHash ?? "")) return refuse(FINANCE_LOCK_MESSAGES.sameAsBefore)
  await replacePassword(viewer, stored, password, isSecure)
  return { ok: true, message: FINANCE_LOCK_MESSAGES.changed }
}

/**
 * A forgotten Finance password, reset with the password the person signs in with. Somebody holding
 * only a signed-in laptop still cannot open Finance, because they need to know that password too,
 * and those tries count towards the same lockout.
 */
export async function resetFinancePassword(viewer: Viewer, accountPassword: string, password: string, isSecure: boolean): Promise<LockResult> {
  const attempt = await takeAttempt(viewer)
  if (!attempt.ok) return attempt.result
  const { stored } = attempt
  const refused = await settleAttempt(viewer, stored, await verifyPassword(accountPassword, stored.passwordHash), FINANCE_LOCK_MESSAGES.accountPasswordWrong)
  if (refused) return refused
  await replacePassword(viewer, stored, password, isSecure)
  return { ok: true, message: FINANCE_LOCK_MESSAGES.reset }
}
