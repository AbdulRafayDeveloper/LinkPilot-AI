import { z } from "zod"
import { MODEL_PROVIDERS } from "@/constants/aiProviders"
import { AI_MODULE_IDS, MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"

// A module's order: every provider, each exactly once
export const ModelOrderSchema = z
  .array(z.enum(MODEL_PROVIDERS), { error: MODEL_PRIORITY_MESSAGES.badOrder })
  .length(MODEL_PROVIDERS.length, MODEL_PRIORITY_MESSAGES.badOrder)
  .refine((order) => new Set(order).size === order.length, MODEL_PRIORITY_MESSAGES.badOrder)

export const ModelPriorityInputSchema = z.object({ order: ModelOrderSchema })

export const AiModuleSchema = z.enum(AI_MODULE_IDS, { error: MODEL_PRIORITY_MESSAGES.unknownModule })
