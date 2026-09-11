import { TRENDING_TOPIC_COUNT } from "@/constants/trending"
import { getActiveTrendingPrompt } from "./prompt"
import { runTrendingResearch } from "./research"
import { synthesizeTopics } from "./synthesize"
import { finalizeTopics } from "./finalize"
import { humanizeTopicPosts } from "./humanize"
import { TrendingResultSchema, type TrendingResult, type TrendingStage } from "./schema"

interface FindTrendingOptions {
  signal: AbortSignal
  onStage: (stage: TrendingStage, text: string) => void
}

function buildNotice(topicCount: number, rejectedCount: number, shortfallReason: string | null): string | null {
  if (topicCount >= TRENDING_TOPIC_COUNT) return null
  const parts = [
    shortfallReason?.trim() ||
      `Only ${topicCount} of ${TRENDING_TOPIC_COUNT} topics met the freshness and relevance threshold in this search.`,
  ]
  if (rejectedCount > 0) {
    parts.push(
      rejectedCount === 1
        ? "1 candidate was removed because its source, date or freshness couldn't be verified, or it duplicated another topic."
        : `${rejectedCount} candidates were removed because their sources, dates or freshness couldn't be verified, or they duplicated other topics.`
    )
  }
  return parts.join(" ")
}

/**
 * Fresh end-to-end Trending Topics run: latest saved prompt → live web research
 * (Gemini with Google Search, OpenAI web search fallback) → structured ranking (Gemini,
 * OpenAI fallback) → source verification → the Humanization prompt on every post.
 * Nothing is cached between runs.
 */
export async function findTrendingTopics({ signal, onStage }: FindTrendingOptions): Promise<TrendingResult> {
  const now = new Date()
  const { prompt } = await getActiveTrendingPrompt()

  onStage("RESEARCHING", "Searching the live web for the latest developments")
  const research = await runTrendingResearch({
    brief: prompt,
    now,
    signal,
    onFallback: () => onStage("FALLBACK", "Primary search unavailable, switching to backup web search"),
  })

  onStage("RANKING", `Comparing ${research.sources.length} sources, ranking candidates and preparing LinkedIn searches`)
  const output = await synthesizeTopics({ brief: prompt, research, now, signal })

  onStage("VERIFYING", "Verifying references and freshness")
  const finalized = finalizeTopics(output.topics, research, now)
  const { rejected } = finalized

  onStage("HUMANIZING", "Making the posts sound natural")
  const { topics, humanized } = await humanizeTopicPosts(finalized.topics, signal)
  // A JSON string, so the dev log file keeps the details (it flattens objects to {})
  console.info(
    "Trending Topics run:",
    JSON.stringify({
      provider: research.provider,
      sources: research.sources.length,
      candidates: output.candidates_evaluated,
      proposed: output.topics.length,
      accepted: topics.length,
      rejected,
      humanized,
    })
  )

  const parsed = TrendingResultSchema.safeParse({
    topics,
    notice: buildNotice(topics.length, rejected.length, output.shortfall_reason),
    research_metadata: {
      searched_at: now.toISOString(),
      search_provider: research.provider,
      sources_checked: research.sources.length,
      candidates_evaluated: Math.max(0, Math.round(output.candidates_evaluated)),
    },
  })
  if (!parsed.success) {
    throw new Error(`TrendingResultValidationException: ${parsed.error.message}`)
  }
  return parsed.data
}
