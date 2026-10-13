import { createHmac, timingSafeEqual } from "crypto"
import { env } from "@/config/env"

/**
 * The token a meeting's share link carries. **Nothing secret is stored**: the token is the
 * meeting's id plus an HMAC over that id and the meeting's own `publicLinkVersion`, so raising the
 * version stops every link already sent and `publicLinkActive` turns them all off at once.
 *
 * It is the same shape an employee's plan link and a client project's link use, with **its own
 * purpose string**, so a plan or a project token can never open a meeting and a meeting token can
 * never open either of them, however the three ids line up.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/
// Named for this link alone, so a signature made for another kind of link never matches here
const PURPOSE = "linkpilot-meeting-link"

const signature = (meetingId: string, version: number) =>
  createHmac("sha256", env.AUTH_SECRET).update(`${PURPOSE}:${meetingId}:${version}`).digest()

export const meetingLinkToken = (meetingId: string, version: number) =>
  `${meetingId}.${signature(meetingId, version).toString("base64url")}`

/** The pieces of a token, or null for anything that isn't shaped like one at all. */
export function readMeetingLinkToken(token: string): { meetingId: string; signature: Buffer } | null {
  const [meetingId, given] = token.split(".")
  if (!meetingId || !given || !ID_PATTERN.test(meetingId) || !/^[\w-]{20,64}$/.test(given)) return null
  return { meetingId, signature: Buffer.from(given, "base64url") }
}

/** Whether a read token was signed for this meeting at the version it holds now. */
export function meetingLinkMatches(read: { meetingId: string; signature: Buffer }, version: number): boolean {
  const expected = signature(read.meetingId, version)
  return read.signature.length === expected.length && timingSafeEqual(read.signature, expected)
}
