import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { loadSearchLenses, runLiveResearch, type ResearchResult } from "@/services/liveResearch"
import { sanitizeForTag } from "./sanitize"

// One parallel research pass per lens, with either provider; merged they give enough candidates for every topic slot
const PASS_CANDIDATE_TARGET = "6–10"
const MIN_RESEARCH_SOURCES = 3

interface ResearchOptions {
  brief: string
  now: Date
  signal: AbortSignal
  onFallback: () => void
}

function buildResearchMessages(brief: string, now: Date, searchFocus: string): BaseMessage[] {
  const system = renderPrompt(loadPrompt("trending-research"), {
    CURRENT_DATETIME: now.toISOString(),
    CANDIDATE_TARGET: PASS_CANDIDATE_TARGET,
    SEARCH_FOCUS: searchFocus,
  })
  return [
    new SystemMessage(system),
    new HumanMessage(
      `<research_brief>\n${sanitizeForTag(brief)}\n</research_brief>\n\nSearch the web now and reply only with the research report format from your instructions.`
    ),
  ]
}

/**
 * Runs live trend research over the subject-agnostic lenses in trending-search-lenses.md.
 * The configured brief still decides the subject area.
 */
export async function runTrendingResearch({ brief, now, signal, onFallback }: ResearchOptions): Promise<ResearchResult> {
  const passes = loadSearchLenses("trending-search-lenses").map((lens) => buildResearchMessages(brief, now, lens))
  return runLiveResearch({
    geminiPasses: passes,
    openAIPasses: passes,
    minSources: MIN_RESEARCH_SOURCES,
    signal,
    onFallback,
  })
}
