import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { describeAllLenses, loadSearchLenses, runLiveResearch, type ResearchResult } from "@/services/liveResearch"
import { postBlock, styleInstructionsBlock } from "./blocks"

// One verified source is enough to back a single comment's reference
const MIN_RESEARCH_SOURCES = 1
// Matches the age limit for cited developments in validate.ts
const RESEARCH_WINDOW_DAYS = 7
const DAY_MS = 86_400_000
const RESEARCH_REQUEST = `{{comment_style_instructions}}

{{post_content}}

Search the web now and reply only with the research report format from your instructions.`

interface ResearchOptions {
  postText: string
  // The tune prompt with its variables replaced by readable labels
  styleBrief: string
  now: Date
  signal: AbortSignal
  onFallback: () => void
}

function buildResearchMessages(
  template: string,
  postText: string,
  styleBrief: string,
  now: Date,
  searchFocus: string
): BaseMessage[] {
  const system = renderPrompt(template, {
    CURRENT_DATETIME: now.toISOString(),
    CURRENT_DATE: now.toISOString().slice(0, 10),
    CURRENT_MONTH_YEAR: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    WINDOW_START: new Date(now.getTime() - RESEARCH_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10),
    SEARCH_FOCUS: searchFocus,
  })
  const request = composePromptMessage(RESEARCH_REQUEST, [styleInstructionsBlock(styleBrief), postBlock(postText)])
  return [new SystemMessage(system), new HumanMessage(request)]
}

/**
 * Live web research on the post's subject through the shared Groq → OpenAI search.
 * Returns null instead of failing when nothing verifiable is found, so the comment is
 * still written, just without current-information claims.
 */
export async function researchPostTopic({
  postText,
  styleBrief,
  now,
  signal,
  onFallback,
}: ResearchOptions): Promise<ResearchResult | null> {
  const [template, lenses] = await Promise.all([loadPrompt("comment-writer-research"), loadSearchLenses("comment-writer-research-lenses")])
  try {
    return await runLiveResearch({
      groqPasses: [buildResearchMessages(template, postText, styleBrief, now, describeAllLenses(lenses))],
      openAIPasses: lenses.map((lens) => buildResearchMessages(template, postText, styleBrief, now, lens)),
      minSources: MIN_RESEARCH_SOURCES,
      signal,
      onFallback,
    })
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn("⚠️ Comment Writer research unavailable:", error instanceof Error ? error.message : error)
    return null
  }
}
