import Groq from "groq-sdk"
import { tools as openAITools } from "@langchain/openai"
import type { AIMessage, BaseMessage } from "@langchain/core/messages"
import { createOpenAIModel, isProviderConfigured, withGroqKey, withProviderRetry } from "@/services/ai"
import { env } from "@/config/env"
import { currentModelOrder } from "@/lib/modelOrder"
import { loadPrompt, type PromptName } from "@/services/prompts"
import { UserFacingError } from "@/lib/errors"
import { hostnameOf, normalizeUrl } from "@/lib/url"

const RESEARCH_TIMEOUT_MS = 120_000
// Research passes are long, so a transient failure gets one retry (withProviderRetry) before the pass counts as failed
const RESEARCH_RETRIES = 1
const INLINE_URL_PATTERN = /https?:\/\/[^\s<>"'`\])]+/g

// The providers that can search the web: Groq (browser search on GROQ_MODEL) and OpenAI (web search).
// They run in the request's order (lib/modelOrder.ts); the open-source model can't search, so it is skipped
export const SEARCH_PROVIDERS = ["groq", "openai"] as const
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]

export interface ResearchSource {
  url: string
  title: string
}

export interface ResearchResult {
  provider: SearchProvider
  notes: string
  sources: ResearchSource[]
}

interface LiveResearchOptions {
  // Each entry is one Groq call, which runs several searches of its own; several entries run as parallel passes and are merged
  groqPasses: BaseMessage[][]
  // OpenAI searches shallowly per call, so each entry runs as its own parallel pass
  openAIPasses: BaseMessage[][]
  minSources: number
  signal: AbortSignal
  onFallback: () => void
}

/**
 * Loads subject-agnostic search angles from a prompt with one "- " bullet per lens.
 */
export async function loadSearchLenses(templateName: PromptName): Promise<string[]> {
  return (await loadPrompt(templateName))
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
}

/**
 * For a single research call that should cover every lens.
 */
export function describeAllLenses(lenses: string[]): string {
  return `Cover each of these angles:\n${lenses.map((lens) => `- ${lens}`).join("\n")}`
}

function readTextBlocks(message: AIMessage): Array<{ text: string; annotations: unknown[] }> {
  if (typeof message.content === "string") return [{ text: message.content, annotations: [] }]
  return message.content.flatMap((block) => {
    const candidate = block as { type?: unknown; text?: unknown; annotations?: unknown }
    if (candidate.type !== "text" || typeof candidate.text !== "string") return []
    return [{ text: candidate.text, annotations: Array.isArray(candidate.annotations) ? candidate.annotations : [] }]
  })
}

function dedupeSources(sources: Array<ResearchSource | null>): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>()
  for (const source of sources) {
    if (source && !byUrl.has(source.url)) byUrl.set(source.url, source)
  }
  return [...byUrl.values()]
}

/**
 * OpenAI web search: the report text plus every source it cited, as a structured
 * citation annotation or as a URL written into the report.
 */
function extractOpenAIResearch(message: AIMessage): ResearchResult {
  const sources: ResearchSource[] = []
  const addSource = (rawUrl: string, title?: string) => {
    const url = normalizeUrl(rawUrl)
    if (url) sources.push({ url, title: title?.trim() || hostnameOf(url) })
  }

  let notes = ""
  for (const block of readTextBlocks(message)) {
    notes += block.text
    for (const annotation of block.annotations) {
      const citation = annotation as { url?: unknown; title?: unknown }
      if (typeof citation.url === "string") {
        addSource(citation.url, typeof citation.title === "string" ? citation.title : undefined)
      }
    }
  }
  for (const match of notes.matchAll(INLINE_URL_PATTERN)) {
    addSource(match[0].replace(/[.,;:!?]+$/, ""))
  }

  // Prefer a cited title over the hostname placeholder for the same URL
  const ranked = [...sources].sort((a, b) => Number(a.title === hostnameOf(a.url)) - Number(b.title === hostnameOf(b.url)))
  return { provider: "openai", notes: notes.trim(), sources: dedupeSources(ranked) }
}

const GROQ_ROLES = { system: "system", human: "user", ai: "assistant" } as const

/**
 * One Groq call with browser search: the model runs its own searches and opens pages, and only the
 * pages its searches returned count as sources; URLs it writes into its text are not trusted.
 */
async function runGroqPass(messages: BaseMessage[], signal: AbortSignal): Promise<ResearchResult> {
  const model = env.GROQ_MODEL
  if (!model) throw new UserFacingError("GROQ_MODEL is not set.")
  const passSignal = AbortSignal.any([signal, AbortSignal.timeout(RESEARCH_TIMEOUT_MS)])
  const conversation = messages.map((message) => ({
    role: GROQ_ROLES[message.getType() as keyof typeof GROQ_ROLES] ?? "user",
    content: typeof message.content === "string" ? message.content : readTextBlocks(message as AIMessage).map((block) => block.text).join("\n"),
  }))
  const response = await withProviderRetry(
    "groq",
    () =>
      withGroqKey(
        (apiKey) =>
          new Groq({ apiKey, maxRetries: 0 }).chat.completions.create(
            { model, messages: conversation, tools: [{ type: "browser_search" }], tool_choice: "required" },
            { signal: passSignal }
          ),
        passSignal
      ),
    passSignal,
    RESEARCH_RETRIES
  )
  const message = response.choices[0]?.message
  const sources = (message?.executed_tools ?? [])
    .flatMap((tool) => tool.search_results?.results ?? [])
    .map((result): ResearchSource | null => {
      const url = result.url ? normalizeUrl(result.url) : null
      return url ? { url, title: result.title?.trim() || hostnameOf(url) } : null
    })
  return { provider: "groq", notes: (message?.content ?? "").trim(), sources: dedupeSources(sources) }
}

/**
 * Runs research passes in parallel and merges the ones that succeed. Fails only when
 * every pass fails.
 */
async function runPasses(
  provider: SearchProvider,
  passes: BaseMessage[][],
  runPass: (messages: BaseMessage[]) => Promise<ResearchResult>
): Promise<ResearchResult> {
  const results = await Promise.allSettled(passes.map(runPass))
  const succeeded = results.flatMap((pass) => (pass.status === "fulfilled" ? [pass.value] : []))
  if (succeeded.length === 0) {
    const firstFailure = results.find((pass) => pass.status === "rejected")
    throw firstFailure?.reason ?? new Error(`WebSearchException: every ${provider} search pass failed`)
  }
  if (succeeded.length < results.length) {
    console.warn(`⚠️ ${results.length - succeeded.length} of ${results.length} ${provider} search passes failed`)
  }
  return {
    provider,
    notes:
      succeeded.length === 1
        ? succeeded[0].notes
        : succeeded.map((result, index) => `### Search pass ${index + 1}\n${result.notes}`).join("\n\n"),
    sources: dedupeSources(succeeded.flatMap((result) => result.sources)),
  }
}

function searchWithGroq(passes: BaseMessage[][], signal: AbortSignal): Promise<ResearchResult> {
  return runPasses("groq", passes, (messages) => runGroqPass(messages, signal))
}

function searchWithOpenAI(passes: BaseMessage[][], signal: AbortSignal): Promise<ResearchResult> {
  const model = createOpenAIModel({ timeout: RESEARCH_TIMEOUT_MS, maxRetries: 0 })
  const webSearch = openAITools.webSearch({ search_context_size: "high" })
  return runPasses("openai", passes, async (messages) => {
    // "required" stops the model from answering from memory without searching
    const response = await withProviderRetry(
      "openai",
      () => model.invoke(messages, { tools: [webSearch], tool_choice: "required", signal }),
      signal,
      RESEARCH_RETRIES
    )
    return extractOpenAIResearch(response)
  })
}

function hasUsableEvidence(result: ResearchResult, minSources: number): boolean {
  return result.notes.length > 0 && result.sources.length >= minSources
}

const canSearch: Record<SearchProvider, () => boolean> = {
  groq: () => isProviderConfigured("groq"),
  openai: () => isProviderConfigured("openai"),
}

const isSearchProvider = (provider: string): provider is SearchProvider => (SEARCH_PROVIDERS as readonly string[]).includes(provider)

/**
 * Live web research with the providers that can search, in the request's order (Groq's browser search
 * first by default, then OpenAI web search). The next provider takes over when one isn't configured,
 * fails, or returns too little evidence; the last one's thin result is an error.
 */
export async function runLiveResearch({ groqPasses, openAIPasses, minSources, signal, onFallback }: LiveResearchOptions): Promise<ResearchResult> {
  const providers = currentModelOrder().filter(isSearchProvider).filter((provider) => canSearch[provider]())
  if (providers.length === 0) {
    throw new UserFacingError(
      "No AI provider is configured for live research. Set GROQ_API_KEY_1 and GROQ_MODEL, or OPENAI_API_KEY and OPENAI_LIGHTWEIGHT_MODEL, where the app runs."
    )
  }

  for (const [index, provider] of providers.entries()) {
    const isLast = index === providers.length - 1
    try {
      const result = provider === "groq" ? await searchWithGroq(groqPasses, signal) : await searchWithOpenAI(openAIPasses, signal)
      if (hasUsableEvidence(result, minSources)) return result
      console.warn(`⚠️ ${provider} research returned too few sources`, { sources: result.sources.length })
      if (isLast) throw new Error(`InsufficientEvidenceException: web search returned ${result.sources.length} usable sources`)
    } catch (error: unknown) {
      if (signal.aborted || isLast) throw error
      console.warn(`⚠️ ${provider} research failed:`, error instanceof Error ? error.message : error)
    }
    onFallback()
  }
  throw new Error("InsufficientEvidenceException: no research provider answered")
}
