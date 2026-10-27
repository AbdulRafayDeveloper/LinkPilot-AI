import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { loadSearchLenses, runLiveResearch, type ResearchResult } from "@/services/liveResearch"
import type { FallbackNotice } from "@/constants/aiProviders"
import { sanitizeForTag } from "./sanitize"

// One parallel research pass per lens, with either provider; merged they give enough candidates for every topic slot
const PASS_CANDIDATE_TARGET = "6–10"
const MIN_RESEARCH_SOURCES = 3

interface ResearchOptions {
  brief: string
  now: Date
  signal: AbortSignal
  onFallback: FallbackNotice
}

function buildResearchMessages(template: string, brief: string, now: Date, searchFocus: string, book: PromptBook): BaseMessage[] {
  const system = renderPrompt(template, {
    CURRENT_DATETIME: now.toISOString(),
    CANDIDATE_TARGET: PASS_CANDIDATE_TARGET,
    SEARCH_FOCUS: searchFocus,
  })
  return [
    new SystemMessage(system),
    new HumanMessage(book.text("research.request", { brief: sanitizeForTag(brief) })),
  ]
}

/**
 * Runs live trend research over the subject-agnostic lenses in the trending-search-lenses prompt.
 * The configured brief still decides the subject area.
 */
export async function runTrendingResearch({ brief, now, signal, onFallback }: ResearchOptions): Promise<ResearchResult> {
  const [template, lenses, book] = await Promise.all([
    loadPrompt("trending-research"),
    loadSearchLenses("trending-search-lenses"),
    loadPromptBook("trending-instructions"),
  ])
  const passes = lenses.map((lens) => buildResearchMessages(template, brief, now, lens, book))
  return runLiveResearch({
    groqPasses: passes,
    openAIPasses: passes,
    minSources: MIN_RESEARCH_SOURCES,
    signal,
    onFallback,
  })
}
