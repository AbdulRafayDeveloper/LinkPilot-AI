import { connectDatabase } from "@/lib/db"
import { TrendingSearch } from "@/models/TrendingSearch"
import { TrendingResultSchema, type TrendingResult } from "./schema"

/**
 * Trending Topics searches, shared by everyone who opens the page. Every search is kept in
 * the trending_searches collection; the page shows the newest one that found topics, until
 * someone presses Reset. Reset only dismisses searches, so the history is never lost.
 */

/**
 * The search on show, or null when nobody has searched since the last Reset. A saved
 * result that no longer reads back as valid counts as none.
 */
export async function readSavedTrendingResult(): Promise<TrendingResult | null> {
  await connectDatabase()
  const latest = await TrendingSearch.findOne({ dismissedAt: null, topicCount: { $gt: 0 } }, { result: 1 })
    .sort({ createdAt: -1 })
    .lean()
  if (!latest) return null
  const parsed = TrendingResultSchema.safeParse(latest.result)
  if (!parsed.success) console.warn("⚠️ The saved Trending Topics search isn't a valid result; showing none")
  return parsed.success ? parsed.data : null
}

/**
 * Adds a search to the history. One that found topics becomes the search everyone sees.
 */
export async function saveTrendingResult(result: TrendingResult): Promise<void> {
  await connectDatabase()
  await TrendingSearch.create({
    result,
    topicCount: result.topics.length,
    searchProvider: result.research_metadata.search_provider,
    searchedAt: new Date(result.research_metadata.searched_at),
  })
}

// Reset: hides the topics on show for everyone, keeping every search in the history
export async function clearSavedTrendingResult(): Promise<void> {
  await connectDatabase()
  await TrendingSearch.updateMany({ dismissedAt: null }, { dismissedAt: new Date() })
}
