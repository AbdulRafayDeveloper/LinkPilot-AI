import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/config/env"

/**
 * An employee's private link to their daily plan. The token is the employee's id and an HMAC of
 * that id and the link's version, signed with AUTH_SECRET, so nothing secret is stored in the
 * database and a link can't be guessed or edited to open another employee. Replacing the link
 * bumps the version, which stops every earlier token working; changing AUTH_SECRET stops them all.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

const signature = (employeeId: string, version: number) =>
  createHmac("sha256", env.AUTH_SECRET).update(`linkpilot-plan-link:${employeeId}:${version}`).digest()

export const planLinkToken = (employeeId: string, version: number) => `${employeeId}.${signature(employeeId, version).toString("base64url")}`

/** The employee id a token names, before its signature is checked against their current version. */
export function readPlanLinkToken(token: string): { employeeId: string; signature: Buffer } | null {
  const [employeeId, given] = token.split(".")
  if (!employeeId || !given || !ID_PATTERN.test(employeeId) || !/^[\w-]{20,64}$/.test(given)) return null
  return { employeeId, signature: Buffer.from(given, "base64url") }
}

export function planLinkMatches(read: { employeeId: string; signature: Buffer }, version: number): boolean {
  const expected = signature(read.employeeId, version)
  return read.signature.length === expected.length && timingSafeEqual(read.signature, expected)
}
