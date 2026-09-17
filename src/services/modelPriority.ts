import { connectDatabase } from "@/lib/db"
import { resolveModelOrder } from "@/lib/modelOrder"
import { ModelPriority, type IModelPriority } from "@/models/ModelPriority"
import { AI_PROVIDER_LABELS, DEFAULT_MODEL_ORDER, MODEL_PROVIDERS, type AiProviderId } from "@/constants/aiProviders"
import { AI_MODULE_IDS, AI_MODULE_NEEDS, type AiModuleId } from "@/constants/modelPriority"
import { APP_TOOLS } from "@/constants/linkedinTools"
import { isGroqTranscriptionConfigured, isProviderConfigured, isTranscriptionConfigured } from "@/services/ai"
import { accountNames } from "@/services/auth/accounts"
import type { Viewer } from "@/types/auth"
import type { ModelPriorityOverview, ModelProviderStatus } from "@/types/modelPriority"

/**
 * AI Model Priority. Every module tries the providers in DEFAULT_MODEL_ORDER (Groq first). An admin
 * can save another order for a module, and it is used for admins' requests to that module only: a
 * regular user always gets the default, whatever is saved here.
 */

/** The order to run a module's AI calls in, for the account asking. One indexed read, and only for an admin. */
export async function modelOrderFor(viewer: Viewer, module: AiModuleId): Promise<readonly AiProviderId[]> {
  if (viewer.role !== "admin") return DEFAULT_MODEL_ORDER
  await connectDatabase()
  const saved = (await ModelPriority.findOne({ module }, { order: 1 }).lean()) as Pick<IModelPriority, "order"> | null
  return resolveModelOrder(viewer.role, saved?.order)
}

function providerStatuses(): ModelProviderStatus[] {
  return MODEL_PROVIDERS.map((id) => ({
    id,
    label: AI_PROVIDER_LABELS[id],
    configured: isProviderConfigured(id),
    can: {
      "web-search": id !== "open-source" && isProviderConfigured(id),
      screenshots: isProviderConfigured(id, "image"),
      speech: id === "groq" ? isGroqTranscriptionConfigured() : id === "openai" ? isTranscriptionConfigured() : false,
    },
  }))
}

const toolTitle = (module: AiModuleId) => APP_TOOLS.find((tool) => tool.id === module)?.title ?? module

/** Every AI module with the order it uses for admins, and what each provider can do on this deployment. */
export async function getModelPriorities(): Promise<ModelPriorityOverview> {
  await connectDatabase()
  const saved = (await ModelPriority.find({ module: { $in: [...AI_MODULE_IDS] } }).lean()) as IModelPriority[]
  const byModule = new Map(saved.map((entry) => [entry.module, entry]))
  const names = await accountNames(saved.map((entry) => entry.updatedBy))
  return {
    modules: AI_MODULE_IDS.map((id) => {
      const entry = byModule.get(id)
      const order = resolveModelOrder("admin", entry?.order)
      const isDefault = order.every((provider, index) => provider === DEFAULT_MODEL_ORDER[index])
      return {
        id,
        title: toolTitle(id),
        needs: [...AI_MODULE_NEEDS[id]],
        order: [...order],
        isDefault,
        updatedAt: entry && !isDefault ? new Date(entry.updatedAt).toISOString() : null,
        updatedBy: entry && !isDefault ? (names.get(entry.updatedBy) ?? null) : null,
      }
    }),
    providers: providerStatuses(),
    defaultOrder: [...DEFAULT_MODEL_ORDER],
  }
}

/** Saves a module's order for admins. Saving the default order removes the setting, so the module follows the default again. */
export async function saveModelPriority(viewer: Viewer, module: AiModuleId, order: readonly AiProviderId[]): Promise<void> {
  await connectDatabase()
  const isDefault = order.every((provider, index) => provider === DEFAULT_MODEL_ORDER[index])
  if (isDefault) {
    await ModelPriority.deleteOne({ module })
    return
  }
  await ModelPriority.updateOne({ module }, { $set: { order: [...order], updatedBy: viewer.id } }, { upsert: true })
}
