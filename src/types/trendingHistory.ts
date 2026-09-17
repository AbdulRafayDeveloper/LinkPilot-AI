import type { SavedTopicStatus, TrendingPostFormatId } from "@/constants/trending"
import type { StoredTrendingTopic } from "@/services/trending/schema"

/**
 * One topic a Trending Topics search found, read back from the search it belongs to. The search's
 * own details (when it ran, whether it is still on the page) come with it, because a topic on its
 * own cannot say where it stands.
 */
export interface SavedTopic {
  // The search and the topic's place in it, which together identify the topic
  searchId: string
  rank: number
  title: string
  category: string
  whyTrending: string
  // Older searches were saved before posts had a format
  postFormat: TrendingPostFormatId | null
  eventDate: string | null
  freshness: string
  confidence: string
  // The ready-to-post text, assembled the same way the search page copies it
  post: string
  // The searches to run on LinkedIn for this topic (three to five). The source is not in the list:
  // it is read on the topic's own view
  linkedinSearches: string[]
  searchedAt: string
  status: SavedTopicStatus
}

/** One saved topic read in full, for its own view: everything the search page shows, plus where it stands. */
export interface SavedTopicDetail {
  searchId: string
  rank: number
  searchedAt: string
  status: SavedTopicStatus
  topic: StoredTrendingTopic
}

/**
 * One page of saved topics. Paging is by page number because topics live inside their searches:
 * the service unwinds them, filters them and counts them in the same query.
 */
export interface SavedTopicsPage {
  items: SavedTopic[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // Every category any saved topic uses, one label each, for the filter
  categories: string[]
}

/** What the page can filter by. Everything is optional; nothing set means every topic. */
export interface SavedTopicFilters {
  page: number
  search: string
  category: string
  format: string
  status: SavedTopicStatus | ""
  // ISO timestamps for the start and end of the chosen days, in the viewer's own timezone
  from: string | null
  to: string | null
}
