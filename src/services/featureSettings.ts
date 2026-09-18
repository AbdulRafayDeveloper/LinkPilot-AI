import { connectDatabase } from "@/lib/db"
import { manageableFeatures } from "@/constants/featureAccess"
import { FEATURE_SETTINGS_SCOPE, FeatureSettingsModel } from "@/models/FeatureSettings"

/**
 * The tools turned off for every user at once. Read on every request, by `getViewer`, because turning
 * a tool off has to take effect on the next request rather than whenever a cache runs out: it is one
 * small indexed read, run alongside the account's own. With nothing saved, every tool is on.
 */

/** Every tool an admin may turn off, in the sidebar's order: the order everything is stored in. */
export const manageableToolIds = (): string[] => manageableFeatures().map((tool) => tool.id)

/** In the sidebar's order, whatever order they were saved in. */
export const inToolOrder = (toolIds: readonly string[]): string[] => {
  const wanted = new Set(toolIds)
  return manageableToolIds().filter((toolId) => wanted.has(toolId))
}

export async function readFeatureDefaults(): Promise<string[]> {
  await connectDatabase()
  const settings = await FeatureSettingsModel.findOne({ scope: FEATURE_SETTINGS_SCOPE }, { disabledTools: 1 }).lean()
  return inToolOrder(settings?.disabledTools ?? [])
}

/**
 * Turns the named tools on or off for every user. It is one atomic update that adds or removes only
 * those tools, never a list rebuilt from a copy read a moment earlier, so two admins changing
 * different tools at the same moment can never undo each other.
 */
export async function changeFeatureDefaults(toolIds: readonly string[], on: boolean, adminEmail: string): Promise<string[]> {
  await connectDatabase()
  const change = on ? { $pull: { disabledTools: { $in: [...toolIds] } } } : { $addToSet: { disabledTools: { $each: [...toolIds] } } }
  await FeatureSettingsModel.updateOne({ scope: FEATURE_SETTINGS_SCOPE }, { ...change, $set: { updatedBy: adminEmail } }, { upsert: true })
  return readFeatureDefaults()
}
