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
  // Which model does each job in each module, and which take over (services/modelMap.ts)
  modelMap: ModelMap
}

// One provider that really runs a job, with the model it uses (from env)
export interface ModelChainStep {
  provider: AiProviderId
  label: string
  model: string
}

// A provider in the order that is passed over for this job, and why
export interface ModelSkip {
  provider: AiProviderId
  label: string
  reason: string
}

export interface ModelMapRow {
  module: string
  title: string
  // The job in words ("Writes the text", "Reads screenshots")
  job: string
  // What every regular user gets: the first is the default, the rest take over in turn
  chain: ModelChainStep[]
  skipped: ModelSkip[]
  // Only when an admin saved a different order for this module and it changes this job
  adminChain: ModelChainStep[] | null
  note: string | null
}

export interface ModelMap {
  rows: ModelMapRow[]
  groqKeys: number
  // The GROQ_API_KEY_<n> every Groq call starts from now
  groqActiveKey: number | null
}
