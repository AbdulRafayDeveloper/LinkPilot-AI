import { TRENDING_TOPIC_COUNT } from "@/constants/trending"
import { composeTrendingPost } from "@/lib/trendingPost"
import { getActiveTrendingPrompt } from "./prompt"
import { runTrendingResearch } from "./research"
import { synthesizeTopics } from "./synthesize"
import { finalizeTopics, type RejectionReason } from "./finalize"
import { expandShortPosts } from "./expand"
import { humanizeTopicPosts } from "./humanize"
import { TrendingResultSchema, type TrendingResult, type TrendingStage } from "./schema"

interface FindTrendingOptions {
  signal: AbortSignal
  onStage: (stage: TrendingStage, text: string) => void
}

// What each rejection means in the user's words, so a thin search says what actually went wrong
const REJECTION_WORDING: Record<RejectionReason, string> = {
  unverified_source: "no source the live search returned",
  unverified_date: "no date the sources confirm",
  incomplete: "a missing title, post or search query",
  duplicate: "the same development as another topic",
  weak_post: "a post too thin to publish",
}

// One round to fix what the tone rewrite broke, one more for anything the fix missed
const REPAIR_ROUNDS = 2

function buildNotice(
  topicCount: number,
  rejected: Array<{ reason: RejectionReason }>,
  shortfallReason: string | null
): string | null {
  if (topicCount >= TRENDING_TOPIC_COUNT) return null
  const parts = [
    shortfallReason?.trim() ||
      `Only ${topicCount} of ${TRENDING_TOPIC_COUNT} topics met the freshness and relevance threshold in this search.`,
  ]
  const counts = new Map<RejectionReason, number>()
  for (const { reason } of rejected) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  const reasons = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (reasons.length > 0) {
    const listed = reasons.map(([reason, count]) => `${count} had ${REJECTION_WORDING[reason]}`).join(", ")
    parts.push(`${rejected.length === 1 ? "1 candidate was" : `${rejected.length} candidates were`} removed. ${listed}.`)
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

  onStage("EXPANDING", "Filling out any post that came back too short")
  const { topics: fullLength, expanded } = await expandShortPosts(finalized.topics, research.notes, signal)

  onStage("HUMANIZING", "Making the posts sound natural")
  const { topics: natural, humanized } = await humanizeTopicPosts(fullLength, signal)

  // Rewriting for tone can shorten a post or bring a stock phrase back, so the finished text
  // gets one more repair round. Nothing changes unless a post is still short, still ends on a
  // generic question, or still carries a phrase the reader has seen a hundred times.
  onStage("EXPANDING", "Checking the finished posts one last time")
  const { topics, expanded: repaired } = await expandShortPosts(natural, research.notes, signal, REPAIR_ROUNDS)
  // A JSON string, so the dev log file keeps the details (it flattens objects to {})
  console.info(
    "Trending Topics run:",
    JSON.stringify({
      provider: research.provider,
      sources: research.sources.length,
      candidates: output.candidates_evaluated,
      proposed: output.topics.length,
      accepted: topics.length,
      expanded,
      repaired,
      postLengths: topics.map((topic) => composeTrendingPost(topic).length),
      rejected,
      humanized,
    })
  )

  const parsed = TrendingResultSchema.safeParse({
    topics,
    notice: buildNotice(topics.length, rejected, output.shortfall_reason),
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
