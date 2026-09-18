import { env, GROQ_API_KEYS } from "@/config/env"
import { AI_PROVIDER_LABELS, DEFAULT_MODEL_ORDER, type AiProviderId } from "@/constants/aiProviders"
import { AI_MODULE_IDS, AI_MODULE_NEEDS, VOICE_MODULE_IDS, type AiModuleId } from "@/constants/modelPriority"
import { APP_TOOLS } from "@/constants/linkedinTools"
import { isEmbeddingConfigured, isGroqTranscriptionConfigured, isProviderConfigured, isTranscriptionConfigured } from "@/services/ai"
import { activeGroqKeyNumber } from "@/services/groqKeyState"
import { isImageModelConfigured } from "@/services/imageGeneration"
import type { ModelChainStep, ModelMap, ModelMapRow, ModelSkip } from "@/types/modelPriority"

/**
 * Which model does each job in each module, and which ones take over when it fails: the table at the
 * top of AI Model Priority. It is worked out from what really decides it, so it can't drift from the
 * app: each module's provider order (the default everyone gets, and an admin's own order where one is
 * saved), which providers are configured on this deployment, what each one can do (only some search
 * the web, read screenshots or read speech), and the model names set in env. Model names only, never a
 * key or any other value.
 */

type Job = "text" | "web-search" | "screenshots" | "speech" | "embeddings" | "images"

interface JobSpec {
  label: string
  // The model a provider uses for this job, or null when it can't do it at all
  model: (provider: AiProviderId) => string | null | undefined
  // Whether the provider is set up for this job here
  ready: (provider: AiProviderId) => boolean
  // Why a provider that can't do this job at all is passed over
  cannot: string
  // Only these providers can ever do it, whatever a module's order says
  only?: readonly AiProviderId[]
}

const JOBS: Record<Job, JobSpec> = {
  text: {
    label: "Writes the text",
    model: (provider) => (provider === "groq" ? env.GROQ_MODEL : provider === "open-source" ? env.OPEN_SOURCE_MODEL : env.OPENAI_LIGHTWEIGHT_MODEL),
    ready: (provider) => isProviderConfigured(provider),
    cannot: "can't write text",
  },
  "web-search": {
    label: "Live web research",
    model: (provider) => (provider === "groq" ? env.GROQ_MODEL : provider === "openai" ? env.OPENAI_LIGHTWEIGHT_MODEL : null),
    ready: (provider) => provider !== "open-source" && isProviderConfigured(provider),
    cannot: "can't search the web",
  },
  screenshots: {
    label: "Reads screenshots",
    model: (provider) => (provider === "groq" ? env.GROQ_VISION_MODEL : provider === "openai" ? env.OPENAI_LIGHTWEIGHT_MODEL : null),
    ready: (provider) => isProviderConfigured(provider, "image"),
    cannot: "can't read screenshots",
  },
  speech: {
    label: "Speech to text",
    model: (provider) => (provider === "groq" ? env.GROQ_TRANSCRIPTION_MODEL : provider === "openai" ? env.OPENAI_TRANSCRIPTION_MODEL : null),
    ready: (provider) => (provider === "groq" ? isGroqTranscriptionConfigured() : provider === "openai" ? isTranscriptionConfigured() : false),
    cannot: "can't read speech",
  },
  embeddings: {
    label: "Searches the meeting (embeddings)",
    model: (provider) => (provider === "openai" ? env.OPENAI_EMBEDDING_MODEL : null),
    ready: (provider) => provider === "openai" && isEmbeddingConfigured(),
    cannot: "has no embedding model",
    only: ["openai"],
  },
  images: {
    label: "Draws the image",
    model: (provider) => (provider === "openai" ? env.OPENAI_IMAGE_MODEL : null),
    ready: (provider) => provider === "openai" && isImageModelConfigured(),
    cannot: "can't draw images",
    only: ["openai"],
  },
}

const NOT_CONFIGURED: Record<Job, string> = {
  text: "not configured",
  "web-search": "not configured",
  screenshots: "no vision model set",
  speech: "no speech model set",
  embeddings: "no embedding model set",
  images: "no image model set",
}

/** The providers that really run a job, in order, and the ones passed over with why. */
function chainFor(job: Job, order: readonly AiProviderId[], without: readonly AiProviderId[] = []): { chain: ModelChainStep[]; skipped: ModelSkip[] } {
  const spec = JOBS[job]
  const chain: ModelChainStep[] = []
  const skipped: ModelSkip[] = []
  for (const provider of order) {
    const label = AI_PROVIDER_LABELS[provider]
    const model = spec.model(provider)
    if (without.includes(provider)) skipped.push({ provider, label, reason: "left out here" })
    else if ((spec.only && !spec.only.includes(provider)) || model === null) skipped.push({ provider, label, reason: spec.cannot })
    else if (!spec.ready(provider) || !model) skipped.push({ provider, label, reason: NOT_CONFIGURED[job] })
    else chain.push({ provider, label, model })
  }
  return { chain, skipped }
}

const titleOf = (id: string) => APP_TOOLS.find((tool) => tool.id === id)?.title ?? id

interface RowSpec {
  job: Job
  label?: string
  without?: readonly AiProviderId[]
  // Fixed providers, for work that never follows the module's order
  fixed?: readonly AiProviderId[]
  note?: string
}

/** The jobs each module runs, in the order the table lists them. */
function rowsOf(module: AiModuleId): RowSpec[] {
  const needs = new Set<Job>(AI_MODULE_NEEDS[module])
  if ((VOICE_MODULE_IDS as readonly string[]).includes(module)) needs.add("speech")
  const rows: RowSpec[] = [{ job: "text" }]
  if (module === "meetings") {
    return [
      { job: "text", label: "Analyses a pasted transcript" },
      { job: "text", label: "Analyses a recorded meeting", without: ["openai"], note: "OpenAI is never used for a meeting recorded in the app." },
      { job: "speech", label: "Writes out a recording", fixed: ["groq"], note: "Groq only, by design." },
    ]
  }
  for (const job of ["web-search", "screenshots", "speech"] as const) if (needs.has(job)) rows.push({ job })
  if (module === "meeting-planner") rows.push({ job: "embeddings", fixed: ["openai"], note: "Groq has no embedding model, so the meeting chat's search is OpenAI's." })
  return rows
}

function buildRow(id: string, spec: RowSpec, order: readonly AiProviderId[], adminOrder: readonly AiProviderId[] | null): ModelMapRow {
  const base = spec.fixed ?? order
  const { chain, skipped } = chainFor(spec.job, base, spec.without)
  // An admin's own order changes nothing for work with fixed providers
  const admin = adminOrder && !spec.fixed ? chainFor(spec.job, adminOrder, spec.without).chain : null
  const sameAsUsers = admin && admin.map((step) => step.provider).join() === chain.map((step) => step.provider).join()
  return {
    module: id,
    title: titleOf(id),
    job: spec.label ?? JOBS[spec.job].label,
    chain,
    skipped,
    adminChain: admin && !sameAsUsers ? admin : null,
    note: spec.note ?? null,
  }
}

/** The whole table, with the admins' saved orders (module id to order) where they differ from the default. */
export async function buildModelMap(adminOrders: ReadonlyMap<string, readonly AiProviderId[]>): Promise<ModelMap> {
  const rows: ModelMapRow[] = AI_MODULE_IDS.flatMap((module) =>
    rowsOf(module).map((spec) => buildRow(module, spec, DEFAULT_MODEL_ORDER, adminOrders.get(module) ?? null))
  )
  rows.push(buildRow("post-image-creator", { job: "images", fixed: ["openai"], note: "Only OpenAI draws images." }, DEFAULT_MODEL_ORDER, null))
  return { rows, groqKeys: GROQ_API_KEYS.length, groqActiveKey: await activeGroqKeyNumber() }
}
