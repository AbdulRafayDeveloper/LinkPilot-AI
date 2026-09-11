import { tools as openAITools } from "@langchain/openai"
import type { AIMessage, BaseMessage } from "@langchain/core/messages"
import { AI_PROVIDERS, createGeminiModel, createOpenAIModel, isProviderConfigured, type ModelProvider } from "@/services/ai"
import { loadPrompt, type PromptName } from "@/services/prompts"
import { UserFacingError } from "@/lib/errors"
import { hostnameOf, normalizeUrl } from "@/lib/url"

const RESEARCH_TIMEOUT_MS = 120_000
const RESEARCH_MAX_RETRIES = 1
const REDIRECT_RESOLVE_TIMEOUT_MS = 8_000
const INLINE_URL_PATTERN = /https?:\/\/[^\s<>"'`\])]+/g
// Gemini's built-in Google Search grounding: the model decides which searches to run
const GOOGLE_SEARCH_TOOL = { googleSearch: {} }

// Same providers and order as every other AI call: Gemini first, OpenAI as the fallback
export const SEARCH_PROVIDERS = AI_PROVIDERS
export type SearchProvider = ModelProvider

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
  // Each entry is one grounded Gemini call; several entries run as parallel passes and are merged
  geminiPasses: BaseMessage[][]
  // The fallback OpenAI model searches shallowly per call, so each entry runs as its own parallel pass
  openAIPasses: BaseMessage[][]
  minSources: number
  signal: AbortSignal
  onFallback: () => void
}

interface GroundingChunk {
  web?: { uri?: string; title?: string }
}

/**
 * Loads subject-agnostic search angles from a prompt file with one "- " bullet per lens.
 */
export function loadSearchLenses(templateName: PromptName): string[] {
  return loadPrompt(templateName)
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

/**
 * Grounding sources arrive as Google redirect links. Each is resolved to the article it
 * points to, so citations can be verified against real URLs; unresolvable ones are dropped.
 */
async function resolveGroundingSource(chunk: GroundingChunk, signal: AbortSignal): Promise<ResearchSource | null> {
  const uri = chunk.web?.uri
  if (!uri) return null
  try {
    const response = await fetch(uri, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT_MS)]),
    })
    const url = normalizeUrl(response.headers.get("location") ?? uri)
    return url ? { url, title: chunk.web?.title?.trim() || hostnameOf(url) } : null
  } catch (error: unknown) {
    if (signal.aborted) throw error
    return null
  }
}

/**
 * One grounded Gemini call. Only grounding metadata counts as a source; URLs the model
 * writes into its text are not trusted.
 */
async function runGeminiPass(messages: BaseMessage[], signal: AbortSignal): Promise<ResearchResult> {
  const model = createGeminiModel({ maxRetries: RESEARCH_MAX_RETRIES })
  const response = await model.invoke(messages, {
    tools: [GOOGLE_SEARCH_TOOL],
    signal: AbortSignal.any([signal, AbortSignal.timeout(RESEARCH_TIMEOUT_MS)]),
  })
  const notes = readTextBlocks(response)
    .map((block) => block.text)
    .join("")
    .trim()
  const grounding = response.additional_kwargs.groundingMetadata as { groundingChunks?: GroundingChunk[] } | undefined
  const sources = await Promise.all((grounding?.groundingChunks ?? []).map((chunk) => resolveGroundingSource(chunk, signal)))
  return { provider: "gemini", notes, sources: dedupeSources(sources) }
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

function searchWithGemini(passes: BaseMessage[][], signal: AbortSignal): Promise<ResearchResult> {
  return runPasses("gemini", passes, (messages) => runGeminiPass(messages, signal))
}

function searchWithOpenAI(passes: BaseMessage[][], signal: AbortSignal): Promise<ResearchResult> {
  const model = createOpenAIModel({ timeout: RESEARCH_TIMEOUT_MS, maxRetries: RESEARCH_MAX_RETRIES })
  const webSearch = openAITools.webSearch({ search_context_size: "high" })
  return runPasses("openai", passes, async (messages) => {
    // "required" stops the model from answering from memory without searching
    const response = await model.invoke(messages, { tools: [webSearch], tool_choice: "required", signal })
    return extractOpenAIResearch(response)
  })
}

function hasUsableEvidence(result: ResearchResult, minSources: number): boolean {
  return result.notes.length > 0 && result.sources.length >= minSources
}

/**
 * Live web research: Gemini with Google Search grounding first; OpenAI web search as the
 * automatic fallback when Gemini isn't configured, fails, or returns too little evidence.
 */
export async function runLiveResearch({
  geminiPasses,
  openAIPasses,
  minSources,
  signal,
  onFallback,
}: LiveResearchOptions): Promise<ResearchResult> {
  const canUseGemini = isProviderConfigured("gemini")
  const canUseOpenAI = isProviderConfigured("openai")
  if (!canUseGemini && !canUseOpenAI) {
    throw new UserFacingError(
      "No AI provider is configured for live research. Set GOOGLE_API_KEY and GEMINI_LIGHTWEIGHT_MODEL, or OPENAI_API_KEY and OPENAI_LIGHTWEIGHT_MODEL, in .env.local."
    )
  }

  if (canUseGemini) {
    try {
      const result = await searchWithGemini(geminiPasses, signal)
      if (hasUsableEvidence(result, minSources)) return result
      console.warn("⚠️ Gemini research returned too few sources", { sources: result.sources.length })
    } catch (error: unknown) {
      if (signal.aborted) throw error
      console.warn("⚠️ Gemini research failed:", error instanceof Error ? error.message : error)
    }
    if (!canUseOpenAI) throw new Error("GeminiResearchException: no usable research and no fallback provider configured")
    onFallback()
  }

  const result = await searchWithOpenAI(openAIPasses, signal)
  if (!hasUsableEvidence(result, minSources)) {
    throw new Error(`InsufficientEvidenceException: web search returned ${result.sources.length} usable sources`)
  }
  return result
}
