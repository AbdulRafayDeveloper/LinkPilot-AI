import { z } from "zod"
import { AI_COST_MESSAGES, AI_USAGE_KINDS, MODEL_ID_MAX_LENGTH, PRICE_MAX, PROVIDER_ID_MAX_LENGTH } from "@/constants/aiCosts"
import { isTimeZone } from "@/lib/timeZone"
import { blankToEmpty, choiceParam, DATE_ORDER_ISSUE, dayBoundParam, inDateOrder } from "./listFilters"

const providerId = z.string().trim().min(1, AI_COST_MESSAGES.needsModel).max(PROVIDER_ID_MAX_LENGTH)
const modelId = z.string().trim().min(1, AI_COST_MESSAGES.needsModel).max(MODEL_ID_MAX_LENGTH)
const price = z.number({ error: AI_COST_MESSAGES.badPrice }).finite().min(0, AI_COST_MESSAGES.badPrice).max(PRICE_MAX, AI_COST_MESSAGES.badPrice)

// A provider, model or module the filters name: any short text, since they come from the records
const recordedParam = (max: number) => z.preprocess(blankToEmpty, z.string().max(max))

/** GET /api/admin/ai-costs: the period and the four choices, all optional. */
export const CostQuerySchema = z
  .object({
    from: dayBoundParam,
    to: dayBoundParam,
    provider: recordedParam(PROVIDER_ID_MAX_LENGTH),
    model: recordedParam(MODEL_ID_MAX_LENGTH),
    module: recordedParam(80),
    kind: choiceParam(AI_USAGE_KINDS),
    // The viewer's own timezone, so the days are their days
    tz: z.preprocess((value) => blankToEmpty(value) || "UTC", z.string().max(64).refine(isTimeZone, "Unknown timezone.")),
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)

/** PUT /api/admin/ai-costs/prices: one model's prices. */
export const ModelPriceSchema = z.object({
  provider: providerId,
  model: modelId,
  inputPerMillion: price,
  outputPerMillion: price,
  perAudioMinute: price,
  perCall: price,
})

/** DELETE /api/admin/ai-costs/prices: which model loses its price. */
export const ModelPriceKeySchema = z.object({ provider: providerId, model: modelId })
