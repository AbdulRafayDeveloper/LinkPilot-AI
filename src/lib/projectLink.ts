import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/config/env"

/**
 * A client project's read-only link. The token is the project's id and an HMAC of that id and the
 * link's version, signed with AUTH_SECRET, so nothing secret is stored in the database and a link
 * can't be guessed or edited to open another project. Making a new link bumps the version, which
 * stops every earlier token working; changing AUTH_SECRET stops them all.
 *
 * It is the same shape as an employee's plan link (`lib/planLink.ts`), with its own purpose string
 * so a token from one can never open the other.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

const signature = (projectId: string, version: number) =>
  createHmac("sha256", env.AUTH_SECRET).update(`linkpilot-project-link:${projectId}:${version}`).digest()

export const projectLinkToken = (projectId: string, version: number) => `${projectId}.${signature(projectId, version).toString("base64url")}`

/** The project id a token names, before its signature is checked against that project's version. */
export function readProjectLinkToken(token: string): { projectId: string; signature: Buffer } | null {
  const [projectId, given] = token.split(".")
  if (!projectId || !given || !ID_PATTERN.test(projectId) || !/^[\w-]{20,64}$/.test(given)) return null
  return { projectId, signature: Buffer.from(given, "base64url") }
}

export function projectLinkMatches(read: { projectId: string; signature: Buffer }, version: number): boolean {
  const expected = signature(read.projectId, version)
  return read.signature.length === expected.length && timingSafeEqual(read.signature, expected)
}
