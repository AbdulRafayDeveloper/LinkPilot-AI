import { z } from "zod"
import { MAX_FEATURE_IDS } from "@/constants/featureAccess"

/**
 * What an admin sends when turning tools off for an account: the ids of the tools that account may
 * not use. Which ids are real is checked against the registry in the service, not here, so the
 * list of tools stays in one place.
 */
export const FeatureAccessSchema = z.object({
  disabledTools: z
    .array(z.string().trim().min(1).max(60))
    .max(MAX_FEATURE_IDS, "That is more tools than the app has.")
    .transform((ids) => [...new Set(ids)]),
})

export type FeatureAccessInput = z.infer<typeof FeatureAccessSchema>
