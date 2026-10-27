import { accountPhotoPath } from "@/lib/accountPhoto"
import { UserModel, type IUser } from "@/models/User"
import { manageableFeatures, primaryOnlyFeatures } from "@/constants/featureAccess"
import { childDisabledTools, effectiveDisabledTools } from "@/lib/featureAccess"
import { DEFAULT_COLOR_SCHEME, isColorScheme } from "@/constants/colorScheme"
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
  photoFile: 1,
  timeZone: 1,
  colorScheme: 1,
  role: 1,
  sessionVersion: 1,
  disabledTools: 1,
  enabledTools: 1,
  parentId: 1,
} as const

export type Account = Pick<IUser, "email" | "name" | "role"> &
  Partial<Pick<IUser, "disabledTools" | "enabledTools" | "parentId" | "photoFile" | "timeZone" | "colorScheme">> & { _id: unknown }

/** Every tool a child can be granted. The admin area is not one of them, so it can never be. */
const grantableTools = () => manageableFeatures().map((tool) => tool.id)

export async function viewerOf(user: Account, defaults: readonly string[]): Promise<Viewer> {
  const id = String(user._id)
  const parentId = user.parentId ?? null
  // The photo is the person's, so it is read from this account whether or not it has a parent
  const photo = user.photoFile ? accountPhotoPath({ ownerId: id, file: user.photoFile }) : null
  // So is the timezone: a child sees times in its own zone, not its parent's
  const timeZone = user.timeZone ?? null
  // And the colour scheme; an account from before schemes, or a value the app no longer has, is System
  const colorScheme = isColorScheme(user.colorScheme) ? user.colorScheme : DEFAULT_COLOR_SCHEME
  if (!parentId) {
    return {
      id,
      email: user.email,
      name: user.name,
      photo,
      timeZone,
      colorScheme,
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
    photo,
    timeZone,
    colorScheme,
    role: "user",
    disabledTools: [...disabledTools],
    parentId,
    dataOwnerId: parentId,
  }
}
