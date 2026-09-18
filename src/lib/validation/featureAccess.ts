import { z } from "zod"
import { MAX_FEATURE_IDS } from "@/constants/featureAccess"

/**
 * What an admin sends to change which tools are on: some tools set on or off (one tool, or a whole
 * sidebar group at once), or, for one account, `reset` to drop all of its own choices and follow
 * everyone again. Only the tools named change, so a page holding an older copy can never undo a
 * change it did not know about. Which ids are real is checked against the registry in the service,
 * so the list of tools stays in one place.
 */
const ToolsChangeSchema = z.object({
  tools: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Name at least one tool.")
    .max(MAX_FEATURE_IDS, "That is more tools than the app has.")
    .transform((ids) => [...new Set(ids)]),
  on: z.boolean(),
})

export const FeatureDefaultsChangeSchema = ToolsChangeSchema

export const FeatureAccessChangeSchema = z.union([ToolsChangeSchema, z.object({ reset: z.literal(true) })])

export type ToolsChange = z.infer<typeof ToolsChangeSchema>
export type FeatureAccessChange = z.infer<typeof FeatureAccessChangeSchema>
