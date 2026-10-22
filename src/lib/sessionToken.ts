import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { SESSION_DAYS, SESSION_REFRESH_DAYS } from "@/constants/auth"

/**
 * The signed session cookie. It holds only the account id, the account's session version and
 * when it expires, signed with AUTH_SECRET, so it can't be forged or edited. The proxy trusts the
 * signature alone to decide whether to let a request in; every route then loads the account
 * itself (services/auth/viewer.ts), which is where a deleted account or an ended session is refused.
 */

export const SESSION_COOKIE = "lp_session"
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000
const REFRESH_AFTER_MS = SESSION_REFRESH_DAYS * 24 * 60 * 60 * 1000

const PayloadSchema = z.object({ uid: z.string().regex(/^[0-9a-f]{24}$/), ver: z.number().int().positive(), exp: z.number() })
export type SessionPayload = z.infer<typeof PayloadSchema>

const mac = (body: string, secret: string) => createHmac("sha256", secret).update(`linkpilot-session:${body}`).digest()

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${mac(body, secret).toString("base64url")}`
}

export function readSession(token: string | undefined, secret: string): SessionPayload | null {
  const [body, signature] = token?.split(".") ?? []
  if (!body || !signature) return null
  const expected = mac(body, secret)
  const given = Buffer.from(signature, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const parsed = PayloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")))
    return parsed.success && parsed.data.exp > Date.now() ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Whether this session is worth signing again: it is more than `SESSION_REFRESH_DAYS` old, measured
 * from what the session itself says rather than from anything stored, so a cookie issued while a
 * session was shorter is renewed to a full year the first time it is used.
 */
export const isWorthRefreshing = (session: SessionPayload, now = Date.now()): boolean => session.exp - now < SESSION_MS - REFRESH_AFTER_MS
