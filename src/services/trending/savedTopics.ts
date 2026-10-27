import { connectDatabase } from "@/lib/db"
import { TrendingSearch } from "@/models/TrendingSearch"
import { TrendingResultSchema, type TrendingResult } from "./schema"
import type { Viewer } from "@/types/auth"
import { ownedBy } from "@/services/auth/viewer"

/**
 * Trending Topics searches, one account's at a time. Every search is kept in the trending_searches
 * collection with the account that ran it; the page shows that account's newest search that found
 * topics (for an admin, also the searches from before accounts existed) until they press Reset.
 * Reset only dismisses searches, so the history is never lost.
 */

/**
 * The search on show, or null when nobody has searched since the last Reset. A saved
 * result that no longer reads back as valid counts as none.
 */
export async function readSavedTrendingResult(viewer: Viewer): Promise<TrendingResult | null> {
  await connectDatabase()
  const latest = await TrendingSearch.findOne({ dismissedAt: null, topicCount: { $gt: 0 }, ...ownedBy(viewer) }, { result: 1 })
    .sort({ createdAt: -1 })
    .lean()
  if (!latest) return null
  const parsed = TrendingResultSchema.safeParse(latest.result)
  if (!parsed.success) console.warn("⚠️ The saved Trending Topics search isn't a valid result; showing none")
  return parsed.success ? parsed.data : null
}

/**
 * Adds a search to the history. One that found topics becomes the search its account sees.
 */
export async function saveTrendingResult(viewer: Viewer, result: TrendingResult): Promise<void> {
  await connectDatabase()
  await TrendingSearch.create({
    ownerId: viewer.id,
    result,
    topicCount: result.topics.length,
    searchProvider: result.research_metadata.search_provider,
    searchedAt: new Date(result.research_metadata.searched_at),
  })
}

// Reset: hides the topics on show for this account, keeping every search in the history
export async function clearSavedTrendingResult(viewer: Viewer): Promise<void> {
  await connectDatabase()
  await TrendingSearch.updateMany({ dismissedAt: null, ...ownedBy(viewer) }, { dismissedAt: new Date() })
}
