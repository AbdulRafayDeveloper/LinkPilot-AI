import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { describeAllLenses, loadSearchLenses, runLiveResearch, type ResearchResult } from "@/services/liveResearch"
import type { FallbackNotice } from "@/constants/aiProviders"
import { postBlock, styleInstructionsBlock } from "./blocks"

// One verified source is enough to back a single comment's reference
const MIN_RESEARCH_SOURCES = 1
// Matches the age limit for cited developments in validate.ts
const RESEARCH_WINDOW_DAYS = 7
const DAY_MS = 86_400_000

interface ResearchOptions {
  postText: string
  // The tune prompt with its variables replaced by readable labels
  styleBrief: string
  now: Date
  signal: AbortSignal
  onFallback: FallbackNotice
}

async function buildResearchMessages(
  template: string,
  postText: string,
  styleBrief: string,
  now: Date,
  searchFocus: string,
  book: PromptBook
): Promise<BaseMessage[]> {
  const system = renderPrompt(template, {
    CURRENT_DATETIME: now.toISOString(),
    CURRENT_DATE: now.toISOString().slice(0, 10),
    CURRENT_MONTH_YEAR: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    WINDOW_START: new Date(now.getTime() - RESEARCH_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10),
    SEARCH_FOCUS: searchFocus,
  })
  // The request around the post is the tool's instructions prompt, like every other word sent
  const request = await composePromptMessage(book.text("research.request"), [styleInstructionsBlock(styleBrief, book), postBlock(postText, book)])
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
  const [template, lenses, book] = await Promise.all([
    loadPrompt("comment-writer-research"),
    loadSearchLenses("comment-writer-research-lenses"),
    loadPromptBook("comment-writer-instructions"),
  ])
  try {
    const [groqPass, openAIPasses] = await Promise.all([
      describeAllLenses(lenses).then((focus) => buildResearchMessages(template, postText, styleBrief, now, focus, book)),
      Promise.all(lenses.map((lens) => buildResearchMessages(template, postText, styleBrief, now, lens, book))),
    ])
    return await runLiveResearch({
      groqPasses: [groqPass],
      openAIPasses,
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
