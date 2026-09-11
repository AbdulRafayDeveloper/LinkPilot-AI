import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { describeAllLenses, loadSearchLenses, runLiveResearch, type ResearchResult } from "@/services/liveResearch"
import { sanitizeForTag } from "./sanitize"

// Gemini covers every lens in one grounded call; each fallback OpenAI pass covers one lens
const GEMINI_CANDIDATE_TARGET = "8–15"
const OPENAI_PASS_CANDIDATE_TARGET = "4–6"
const MIN_RESEARCH_SOURCES = 3

interface ResearchOptions {
  brief: string
  now: Date
  signal: AbortSignal
  onFallback: () => void
}

function buildResearchMessages(brief: string, now: Date, searchFocus: string, candidateTarget: string): BaseMessage[] {
  const system = renderPrompt(loadPrompt("trending-research"), {
    CURRENT_DATETIME: now.toISOString(),
    CANDIDATE_TARGET: candidateTarget,
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
  const lenses = loadSearchLenses("trending-search-lenses")
  return runLiveResearch({
    geminiMessages: buildResearchMessages(brief, now, describeAllLenses(lenses), GEMINI_CANDIDATE_TARGET),
    openAIPasses: lenses.map((lens) => buildResearchMessages(brief, now, lens, OPENAI_PASS_CANDIDATE_TARGET)),
    minSources: MIN_RESEARCH_SOURCES,
    signal,
    onFallback,
  })
}
