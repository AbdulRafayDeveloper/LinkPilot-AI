import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/config/env"
import {
  PROMPT_ACCESS_LOCK_HOURS,
  PROMPT_ACCESS_MAX_ATTEMPTS,
  PROMPT_ACCESS_MESSAGES,
  PROMPT_ACCESS_SESSION_HOURS,
} from "@/constants/promptAccess"
import type { PromptAccessStatus } from "@/types/promptAccess"

/**
 * Password protection for every Update Prompt editor, without a database: the password
 * lives in env, and access state lives in two signed, httpOnly cookies scoped to this
 * browser. A session cookie skips the password for 48 hours; an attempts cookie counts
 * wrong passwords and locks the browser out for 24 hours after the third. Cookies are
 * signed with a key derived from the password, so changing it ends every session.
 */

const SESSION_COOKIE = "lp_prompt_session"
const ATTEMPTS_COOKIE = "lp_prompt_attempts"
const HOUR_MS = 60 * 60 * 1000
const SESSION_MS = PROMPT_ACCESS_SESSION_HOURS * HOUR_MS
const LOCK_MS = PROMPT_ACCESS_LOCK_HOURS * HOUR_MS

const SessionSchema = z.object({ kind: z.literal("session"), exp: z.number() })
const AttemptsSchema = z.object({
  kind: z.literal("attempts"),
  failures: z.number().int().nonnegative(),
  lockedUntil: z.number().nullable(),
  exp: z.number(),
})

type SessionToken = z.infer<typeof SessionSchema>
type AttemptsToken = z.infer<typeof AttemptsSchema>
type CookieStore = Awaited<ReturnType<typeof cookies>>

export type PasswordOutcome = "granted" | "rejected" | "locked" | "disabled"

const sha256 = (value: string) => createHash("sha256").update(value).digest()
const signingKey = (password: string) => sha256(`linkpilot-prompt-access:${password}`)
const mac = (body: string, password: string) => createHmac("sha256", signingKey(password)).update(body).digest()

function sign(payload: SessionToken | AttemptsToken, password: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${mac(body, password).toString("base64url")}`
}

function verify<T extends { exp: number }>(token: string | undefined, schema: z.ZodType<T>, password: string): T | null {
  const [body, signature] = token?.split(".") ?? []
  if (!body || !signature) return null
  const expected = mac(body, password)
  const given = Buffer.from(signature, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")))
    return parsed.success && parsed.data.exp > Date.now() ? parsed.data : null
  } catch {
    return null
  }
}

function readAccess(store: CookieStore, password: string) {
  const session = verify(store.get(SESSION_COOKIE)?.value, SessionSchema, password)
  const attempts = verify(store.get(ATTEMPTS_COOKIE)?.value, AttemptsSchema, password)
  const lockedUntil = attempts?.lockedUntil && attempts.lockedUntil > Date.now() ? attempts.lockedUntil : null
  return { session, attempts, lockedUntil }
}

function toStatus(access: ReturnType<typeof readAccess>): PromptAccessStatus {
  const { session, attempts, lockedUntil } = access
  return {
    state: session ? "unlocked" : lockedUntil ? "locked" : "password_required",
    attemptsLeft: Math.max(0, PROMPT_ACCESS_MAX_ATTEMPTS - (attempts?.failures ?? 0)),
    lockedUntil: lockedUntil ? new Date(lockedUntil).toISOString() : null,
    sessionExpiresAt: session ? new Date(session.exp).toISOString() : null,
  }
}

const DISABLED_STATUS: PromptAccessStatus = { state: "disabled", attemptsLeft: 0, lockedUntil: null, sessionExpiresAt: null }

function cookieOptions(expiresAt: number, isSecure: boolean) {
  return { httpOnly: true, sameSite: "strict", secure: isSecure, path: "/", expires: new Date(expiresAt) } as const
}

function passwordMatches(input: string, password: string): boolean {
  return timingSafeEqual(sha256(input), sha256(password))
}

export async function getPromptAccessStatus(): Promise<PromptAccessStatus> {
  const password = env.PROMPT_EDITOR_PASSWORD
  if (!password) return DISABLED_STATUS
  return toStatus(readAccess(await cookies(), password))
}

/**
 * Checks a password attempt and updates this browser's cookies. While locked, attempts
 * are refused without checking the password.
 */
export async function submitPromptPassword(
  input: string,
  isSecure: boolean
): Promise<{ outcome: PasswordOutcome; status: PromptAccessStatus }> {
  const password = env.PROMPT_EDITOR_PASSWORD
  if (!password) return { outcome: "disabled", status: DISABLED_STATUS }

  const store = await cookies()
  const access = readAccess(store, password)
  if (access.session) return { outcome: "granted", status: toStatus(access) }
  if (access.lockedUntil) return { outcome: "locked", status: toStatus(access) }

  const now = Date.now()
  if (passwordMatches(input, password)) {
    const session: SessionToken = { kind: "session", exp: now + SESSION_MS }
    store.set(SESSION_COOKIE, sign(session, password), cookieOptions(session.exp, isSecure))
    store.delete(ATTEMPTS_COOKIE)
    return { outcome: "granted", status: toStatus({ session, attempts: null, lockedUntil: null }) }
  }

  // Wrong password: failures count within a 24-hour window; the last allowed one locks the browser
  const failures = (access.attempts?.failures ?? 0) + 1
  const lockedUntil = failures >= PROMPT_ACCESS_MAX_ATTEMPTS ? now + LOCK_MS : null
  const attempts: AttemptsToken = {
    kind: "attempts",
    failures,
    lockedUntil,
    exp: lockedUntil ?? access.attempts?.exp ?? now + LOCK_MS,
  }
  store.set(ATTEMPTS_COOKIE, sign(attempts, password), cookieOptions(attempts.exp, isSecure))
  return {
    outcome: lockedUntil ? "locked" : "rejected",
    status: toStatus({ session: null, attempts, lockedUntil }),
  }
}

/**
 * Guard for the prompt API routes: null when this browser holds a valid prompt session,
 * otherwise the error response to return.
 */
export async function requirePromptAccess(): Promise<NextResponse | null> {
  const status = await getPromptAccessStatus()
  if (status.state === "unlocked") return null
  if (status.state === "disabled") {
    return NextResponse.json({ success: false, message: PROMPT_ACCESS_MESSAGES.disabled }, { status: 503 })
  }
  return NextResponse.json({ success: false, message: PROMPT_ACCESS_MESSAGES.sessionExpired }, { status: 401 })
}
