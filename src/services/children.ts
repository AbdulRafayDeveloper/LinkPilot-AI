import { connectDatabase } from "@/lib/db"
import { UserFacingError } from "@/lib/errors"
import { hashPassword } from "@/lib/passwords"
import { UserModel } from "@/models/User"
import { AUTH_MESSAGES } from "@/constants/auth"
import { CHILDREN_MESSAGES, MAX_CHILDREN } from "@/constants/children"
import { manageableFeatures } from "@/constants/featureAccess"
import type { ChildAccount, ChildInput, ChildrenPage } from "@/types/children"
import type { Viewer } from "@/types/auth"

/**
 * Child accounts: the accounts a primary account makes for other people to work inside its own
 * workspace. A child's records are its parent's (`dataOwnerId`), so nothing here copies or moves
 * data; the only things a parent decides are who may sign in and which tools each of them opens.
 *
 * Every call starts from the parent, and every child is found by `{ _id, parentId: parent.id }`, so
 * one account can never reach another's children, and a child can never reach any at all.
 */

type StoredChild = {
  _id: unknown
  name: string
  email: string
  enabledTools?: string[]
  lastLoginAt?: Date | null
  loginCount?: number
  createdAt: Date
}

const FIELDS = { name: 1, email: 1, enabledTools: 1, lastLoginAt: 1, loginCount: 1, createdAt: 1 } as const

/** The tools this parent may grant: the ones it may use itself, in the navigation's own order. */
function grantableFor(parent: Viewer): string[] {
  const offForParent = new Set(parent.disabledTools)
  return manageableFeatures()
    .map((tool) => tool.id)
    .filter((toolId) => !offForParent.has(toolId))
}

/**
 * Only a primary account manages child accounts. A child has no workspace of its own, so it has
 * nothing to share and nobody to share it with; it is refused here as well as in the sidebar.
 */
function asParent(viewer: Viewer): Viewer {
  if (viewer.parentId) throw new UserFacingError(CHILDREN_MESSAGES.childrenCannotNest)
  return viewer
}

function toChild(parent: Viewer, record: StoredChild): ChildAccount {
  const grantable = new Set(grantableFor(parent))
  const granted = record.enabledTools ?? []
  return {
    id: String(record._id),
    name: record.name,
    email: record.email,
    grantedTools: granted.filter((toolId) => grantable.has(toolId)),
    // Granted once, but the parent has since lost the tool, so the child does not have it either
    withheldTools: granted.filter((toolId) => !grantable.has(toolId)),
    lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt).toISOString() : null,
    loginCount: record.loginCount ?? 0,
    createdAt: new Date(record.createdAt).toISOString(),
  }
}

export async function listChildren(viewer: Viewer): Promise<ChildrenPage> {
  const parent = asParent(viewer)
  await connectDatabase()
  const records = (await UserModel.find({ parentId: parent.id }, FIELDS).sort({ createdAt: 1 }).lean()) as unknown as StoredChild[]
  return {
    items: records.map((record) => toChild(parent, record)),
    remaining: Math.max(0, MAX_CHILDREN - records.length),
    grantableTools: grantableFor(parent),
  }
}

/**
 * A new child account. It starts with **no tools at all**, so nothing is reachable until the parent
 * grants it, and it is always a `user`: a parent cannot make an admin, exactly as sign-up cannot.
 */
export async function createChild(viewer: Viewer, input: ChildInput): Promise<ChildAccount> {
  const parent = asParent(viewer)
  await connectDatabase()
  if ((await UserModel.countDocuments({ parentId: parent.id })) >= MAX_CHILDREN) {
    throw new UserFacingError(CHILDREN_MESSAGES.tooMany)
  }
  const passwordHash = await hashPassword(input.password)
  try {
    const created = await UserModel.create({
      parentId: parent.id,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: "user",
      enabledTools: [],
      disabledTools: [],
    })
    return toChild(parent, created.toObject() as unknown as StoredChild)
  } catch (error: unknown) {
    // The unique index on the email is what decides, so two accounts can never share one address
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new UserFacingError(AUTH_MESSAGES.emailTaken)
    }
    throw error
  }
}

/**
 * Grants or takes back the named tools for one child, in one atomic update, so two changes made at
 * the same moment never undo each other and a page holding an older list can't overwrite what it
 * did not see. A tool the parent does not have itself is refused rather than quietly stored.
 */
export async function setChildTools(
  viewer: Viewer,
  childId: string,
  change: { tools: string[]; on: boolean }
): Promise<ChildAccount | null> {
  const parent = asParent(viewer)
  const grantable = new Set(grantableFor(parent))
  const unknown = change.tools.filter((toolId) => !grantable.has(toolId))
  if (unknown.length > 0) throw new UserFacingError(CHILDREN_MESSAGES.unknownTool)
  await connectDatabase()
  const updated = (await UserModel.findOneAndUpdate(
    { _id: childId, parentId: parent.id },
    change.on ? { $addToSet: { enabledTools: { $each: change.tools } } } : { $pull: { enabledTools: { $in: change.tools } } },
    { returnDocument: "after", projection: FIELDS }
  ).lean()) as unknown as StoredChild | null
  return updated ? toChild(parent, updated) : null
}

/**
 * A new password for one child. Raising `sessionVersion` ends every sign-in that account has, and
 * nothing of the parent's is touched, so the parent stays signed in with its own password.
 */
export async function setChildPassword(viewer: Viewer, childId: string, password: string): Promise<boolean> {
  const parent = asParent(viewer)
  await connectDatabase()
  const passwordHash = await hashPassword(password)
  const { matchedCount } = await UserModel.updateOne(
    { _id: childId, parentId: parent.id },
    { $set: { passwordHash, failedLogins: 0, lockedUntil: null }, $inc: { sessionVersion: 1 } }
  )
  return matchedCount > 0
}

/**
 * Removes one child account. **Nothing it saved is deleted**, because every record it made was
 * stamped with the parent's id and was always the parent's; only the way in goes.
 */
export async function deleteChild(viewer: Viewer, childId: string): Promise<boolean> {
  const parent = asParent(viewer)
  await connectDatabase()
  const { deletedCount } = await UserModel.deleteOne({ _id: childId, parentId: parent.id })
  return deletedCount > 0
}

/** How many children an account has, for the admin's own view of it. */
export async function countChildren(parentId: string): Promise<number> {
  await connectDatabase()
  return UserModel.countDocuments({ parentId })
}
