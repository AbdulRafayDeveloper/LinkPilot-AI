import { connectDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"
import { manageableFeatures } from "@/constants/featureAccess"
import type { Viewer } from "@/types/auth"

/**
 * What one account may use, for the admin who decides it. Nothing is stored about the tools an
 * account *can* use, only the ones it cannot: an account with nothing turned off has an empty
 * list, which is what every account starts with and what a new tool is on for by default.
 */

export interface FeatureAccess {
  userId: string
  email: string
  name: string
  role: Viewer["role"]
  // The tools this account may not use; always empty for an admin
  disabledTools: string[]
}

const ID_PATTERN = /^[0-9a-f]{24}$/

/** Every tool an admin is allowed to turn off, so the page and the check read the same list. */
export const manageableToolIds = (): string[] => manageableFeatures().map((tool) => tool.id)

/** What one account may use, or null when there is no such account. */
export async function readFeatureAccess(userId: string): Promise<FeatureAccess | null> {
  if (!ID_PATTERN.test(userId)) return null
  await connectDatabase()
  const user = await UserModel.findById(userId, { email: 1, name: 1, role: 1, disabledTools: 1 }).lean()
  if (!user) return null
  return {
    userId: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    // An admin keeps every tool, so anything stored against one is not shown as turned off
    disabledTools: user.role === "admin" ? [] : (user.disabledTools ?? []),
  }
}

export type SaveResult = { access: FeatureAccess } | { error: "missing" | "admin" | "unknown-tool" }

/**
 * Saves the tools an account may not use. It takes effect on that account's next request, because
 * every route loads the account rather than trusting the session, so nobody has to be signed out.
 *
 * An admin's tools are never turned off: they are the ones who decide, and locking an admin out of
 * the admin area would leave nobody able to undo it.
 */
export async function saveFeatureAccess(userId: string, disabledTools: string[]): Promise<SaveResult> {
  const current = await readFeatureAccess(userId)
  if (!current) return { error: "missing" }
  if (current.role === "admin") return { error: "admin" }
  const allowed = new Set(manageableToolIds())
  if (disabledTools.some((toolId) => !allowed.has(toolId))) return { error: "unknown-tool" }
  // One of each, in the order the sidebar lists them, so what is stored reads the same as the page
  const tidied = manageableToolIds().filter((toolId) => disabledTools.includes(toolId))
  await UserModel.updateOne({ _id: userId }, { $set: { disabledTools: tidied } })
  return { access: { ...current, disabledTools: tidied } }
}
