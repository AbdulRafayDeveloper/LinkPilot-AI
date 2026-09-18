import { connectDatabase } from "@/lib/db"
import { effectiveDisabledTools, placeTools } from "@/lib/featureAccess"
import { UserModel } from "@/models/User"
import { changeFeatureDefaults, inToolOrder, manageableToolIds, readFeatureDefaults } from "@/services/featureSettings"
import type { FeatureAccess, FeatureDefaults } from "@/types/featureAccess"
import type { FeatureAccessChange, ToolsChange } from "@/lib/validation/featureAccess"

/**
 * Which tools the accounts may use, for the admin who decides it, in two layers: the settings for
 * every user, and each account's own choices on top, which win for that account alone. Only
 * differences are ever stored, so an account with no choices of its own follows everyone.
 */

const ID_PATTERN = /^[0-9a-f]{24}$/

// Accounts with a choice of their own: at least one tool in either list
const HAS_OWN_CHOICES = { role: "user" as const, $or: [{ "disabledTools.0": { $exists: true } }, { "enabledTools.0": { $exists: true } }] }

const isKnown = (toolIds: readonly string[]) => {
  const allowed = new Set(manageableToolIds())
  return toolIds.every((toolId) => allowed.has(toolId))
}

/** The settings for every user, with how many accounts have choices of their own. */
export async function readDefaultsForAdmin(): Promise<FeatureDefaults> {
  const [disabledTools, customisedUsers] = await Promise.all([readFeatureDefaults(), UserModel.countDocuments(HAS_OWN_CHOICES)])
  return { disabledTools, customisedUsers }
}

export type DefaultsResult = { defaults: FeatureDefaults } | { error: "unknown-tool" }

/** Turns tools on or off for every user; accounts with a choice of their own keep it. */
export async function changeDefaultsForAdmin(change: ToolsChange, adminEmail: string): Promise<DefaultsResult> {
  if (!isKnown(change.tools)) return { error: "unknown-tool" }
  await changeFeatureDefaults(change.tools, change.on, adminEmail)
  return { defaults: await readDefaultsForAdmin() }
}

/** What one account may use, or null when there is no such account. */
export async function readFeatureAccess(userId: string): Promise<FeatureAccess | null> {
  if (!ID_PATTERN.test(userId)) return null
  await connectDatabase()
  const [user, defaults] = await Promise.all([
    UserModel.findById(userId, { email: 1, name: 1, role: 1, disabledTools: 1, enabledTools: 1 }).lean(),
    readFeatureDefaults(),
  ])
  if (!user) return null
  const isAdmin = user.role === "admin"
  return {
    userId: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    defaults,
    // An admin keeps every tool, so nothing stored against one is shown as a choice of its own
    disabledTools: isAdmin ? [] : inToolOrder(user.disabledTools ?? []),
    enabledTools: isAdmin ? [] : inToolOrder(user.enabledTools ?? []),
    effective: inToolOrder(effectiveDisabledTools(user.role, defaults, user)),
  }
}

export type AccessResult = { access: FeatureAccess } | { error: "missing" | "admin" | "unknown-tool" }

/**
 * Changes one account's own choices: some tools set on or off for it, or all of them dropped so it
 * follows everyone again. It is one atomic update that moves only the tools named, so the account's
 * other choices, and a change another admin makes at the same moment, are never lost. It takes effect
 * on the account's next request, because every route works the tools out afresh; nobody is signed out.
 *
 * An admin's tools are never turned off: they are the ones who decide, and locking an admin out of
 * the admin area would leave nobody able to undo it.
 */
export async function changeFeatureAccess(userId: string, change: FeatureAccessChange): Promise<AccessResult> {
  const current = await readFeatureAccess(userId)
  if (!current) return { error: "missing" }
  if (current.role === "admin") return { error: "admin" }

  if ("reset" in change) {
    await UserModel.updateOne({ _id: userId }, { $set: { disabledTools: [], enabledTools: [] } })
  } else {
    if (!isKnown(change.tools)) return { error: "unknown-tool" }
    const placed = placeTools(current.defaults, change.tools, change.on)
    // The named tools leave both lists and land where they belong, in one update
    const keepOthers = (field: "$disabledTools" | "$enabledTools") => ({ $setDifference: [{ $ifNull: [field, []] }, change.tools] })
    await UserModel.updateOne(
      { _id: userId },
      [
        {
          $set: {
            disabledTools: { $setUnion: [keepOthers("$disabledTools"), placed.disabledTools] },
            enabledTools: { $setUnion: [keepOthers("$enabledTools"), placed.enabledTools] },
          },
        },
      ],
      { updatePipeline: true }
    )
  }

  const access = await readFeatureAccess(userId)
  return access ? { access } : { error: "missing" }
}
