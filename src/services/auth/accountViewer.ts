import { UserModel, type IUser } from "@/models/User"
import { manageableFeatures, primaryOnlyFeatures } from "@/constants/featureAccess"
import { childDisabledTools, effectiveDisabledTools } from "@/lib/featureAccess"
import type { Viewer } from "@/types/auth"

/**
 * One account turned into the `Viewer` everything below reads, used both at sign-in and on every
 * request, so the two can never disagree about what an account may see or do.
 *
 * **A child account becomes its parent for data and stays itself for everything else**: `dataOwnerId`
 * is the parent's id, which is what every query and every create is scoped by, while `id` is still
 * the child, for the audit trail and anything personal to the person. Its tools are the ones the
 * parent granted it and never more than the parent has, and it is never an admin.
 */

export const ACCOUNT_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  sessionVersion: 1,
  disabledTools: 1,
  enabledTools: 1,
  parentId: 1,
} as const

export type Account = Pick<IUser, "email" | "name" | "role"> &
  Partial<Pick<IUser, "disabledTools" | "enabledTools" | "parentId">> & { _id: unknown }

/** Every tool a child can be granted. The admin area is not one of them, so it can never be. */
const grantableTools = () => manageableFeatures().map((tool) => tool.id)

export async function viewerOf(user: Account, defaults: readonly string[]): Promise<Viewer> {
  const id = String(user._id)
  const parentId = user.parentId ?? null
  if (!parentId) {
    return {
      id,
      email: user.email,
      name: user.name,
      role: user.role,
      // What is off for everyone, with this account's own choices on top; an admin keeps every tool
      disabledTools: effectiveDisabledTools(user.role, defaults, user),
      parentId: null,
      dataOwnerId: id,
    }
  }

  // The parent is read on the same request, so a tool the parent loses is gone from the child at
  // once, and a child whose parent has been deleted is left with no tools rather than a workspace
  // of its own, which is also all its parent-scoped reads would find
  const parent = (await UserModel.findById(parentId, ACCOUNT_FIELDS).lean()) as Account | null
  const parentDisabled = parent ? effectiveDisabledTools(parent.role, defaults, parent) : grantableTools()
  // One list is the whole truth for a child: the tools it was not granted, plus the primary-only
  // ones nobody can grant it, so the sidebar, every page guard and every route refuse it from here
  // without any of them having to know what a child is
  const disabledTools = new Set(childDisabledTools(grantableTools(), parentDisabled, user.enabledTools ?? []))
  for (const tool of primaryOnlyFeatures()) disabledTools.add(tool.id)
  return {
    id,
    email: user.email,
    name: user.name,
    role: "user",
    disabledTools: [...disabledTools],
    parentId,
    dataOwnerId: parentId,
  }
}
