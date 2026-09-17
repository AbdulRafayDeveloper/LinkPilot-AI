import type { AiProviderId } from "@/constants/aiProviders"
import type { AiModuleId, AiNeed } from "@/constants/modelPriority"

export interface ModelPriorityModule {
  id: AiModuleId
  title: string
  // What the module asks of a provider beyond writing text
  needs: AiNeed[]
  order: AiProviderId[]
  // True while the module uses the default order
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export interface ModelProviderStatus {
  id: AiProviderId
  label: string
  // Set up to write text on this deployment
  configured: boolean
  // What else it can do here, so the page can say which modules it can't help
  can: Record<AiNeed, boolean>
}

export interface ModelPriorityOverview {
  modules: ModelPriorityModule[]
  providers: ModelProviderStatus[]
  defaultOrder: AiProviderId[]
}
