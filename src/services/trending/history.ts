import mongoose, { type PipelineStage } from "mongoose"
import { connectDatabase } from "@/lib/db"
import { escapeForSearch } from "@/lib/listQuery"
import { composeTrendingPost } from "@/lib/trendingPost"
import { TrendingSearch } from "@/models/TrendingSearch"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"
import {
  NO_FORMAT_FILTER,
  TRENDING_HISTORY_MESSAGES,
  TRENDING_POST_FORMAT_IDS,
  type SavedTopicStatus,
  type TrendingPostFormatId,
} from "@/constants/trending"
import { StoredTrendingTopicSchema } from "@/services/trending/schema"
import { UserFacingError } from "@/lib/errors"
import type { SavedTopic, SavedTopicDetail, SavedTopicFilters, SavedTopicsPage } from "@/types/trendingHistory"
import type { Viewer } from "@/types/auth"
import { ownedBy, visibleById, visibleTo } from "@/services/auth/viewer"

/**
 * Every topic every Trending Topics search has found.
 *
 * Topics are not stored on their own: each search keeps its topics inside its result. So the list
 * is one aggregation that unwinds them, filters them, sorts them and counts them in the database,
 * and only the page asked for comes back. The collection is never read into memory whole.
 *
 * The search page shows one search at a time (the newest one with topics that nobody reset), so a
 * topic's status comes from the search it belongs to: on the page now, an earlier search, or
 * dismissed by a Reset. A user sees the topics of their own searches; an admin sees everyone's.
 */

// What one unwound row looks like as it leaves the database
interface TopicRow {
  _id: { toString: () => string }
  rank: number
  searchedAt: Date
  dismissedAt: Date | null
  topic: Record<string, unknown>
}

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value.trim() : fallback)

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [])

/**
 * A saved result is loose JSON written by every version of the app, so each field is read with a
 * fallback rather than trusted, and one odd topic can never break the page it is on.
 */
function toSavedTopic(row: TopicRow, currentSearchId: string | null): SavedTopic {
  const topic = row.topic ?? {}
  const format = text(topic.post_format)
  const searchId = row._id.toString()

  return {
    searchId,
    rank: row.rank + 1,
    title: text(topic.title, "Untitled topic"),
    category: text(topic.category),
    whyTrending: text(topic.why_trending),
    postFormat: (TRENDING_POST_FORMAT_IDS as readonly string[]).includes(format) ? (format as TrendingPostFormatId) : null,
    eventDate: text(topic.event_date) || null,
    freshness: text(topic.freshness),
    confidence: text(topic.confidence),
    post: composeTrendingPost({
      post_hook: text(topic.post_hook),
      post_body: text(topic.post_body),
      post_cta: text(topic.post_cta),
      suggested_hashtags: strings(topic.suggested_hashtags),
    }),
    linkedinSearches: [...new Set(strings(topic.linkedin_search_queries).map((query) => query.trim()).filter(Boolean))],
    searchedAt: new Date(row.searchedAt).toISOString(),
    status: statusOf(searchId, row.dismissedAt, currentSearchId),
  }
}

// Where a topic stands comes from its search: on the page now, an earlier search, or reset away
const statusOf = (searchId: string, dismissedAt: Date | null, currentSearchId: string | null): SavedTopicStatus =>
  dismissedAt ? "dismissed" : searchId === currentSearchId ? "current" : "earlier"

/** The search on the viewer's page right now, found the same way the search page finds it. */
async function currentSearchId(viewer: Viewer): Promise<string | null> {
  const current = await TrendingSearch.findOne({ dismissedAt: null, topicCount: { $gt: 0 }, ...ownedBy(viewer) }, { _id: 1 })
    .sort({ createdAt: -1 })
    .lean()
  return current ? String(current._id) : null
}

/** The conditions that belong to a search rather than to a topic, applied before unwinding. */
function searchConditions(viewer: Viewer, filters: SavedTopicFilters, currentId: string | null): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [{ topicCount: { $gt: 0 } }, visibleTo(viewer)]
  if (filters.from) conditions.push({ searchedAt: { $gte: new Date(filters.from) } })
  if (filters.to) conditions.push({ searchedAt: { $lte: new Date(filters.to) } })
  if (filters.status === "dismissed") conditions.push({ dismissedAt: { $ne: null } })
  if (filters.status === "earlier" || filters.status === "current") conditions.push({ dismissedAt: null })
  // "Current" is exactly one search, and "earlier" is every other search still standing
  // With no search on the page, nothing is "current", so that filter matches nothing
  if (filters.status === "current") conditions.push({ _id: { $in: currentId ? [new mongoose.Types.ObjectId(currentId)] : [] } })
  if (filters.status === "earlier" && currentId) conditions.push({ _id: { $ne: new mongoose.Types.ObjectId(currentId) } })
  return { $and: conditions }
}

/**
 * Categories are sometimes saved as a list ("SaaS, Startup, MVP"), so a category matches as one
 * whole entry in that list: "AI" finds "AI" and "AI, SaaS" but not "AI Tools".
 */
const categoryPattern = (category: string) => new RegExp(`(^|,\\s*)${escapeForSearch(category)}\\s*(,|$)`, "i")

/** The conditions that belong to a topic, applied after unwinding. */
function topicConditions(filters: SavedTopicFilters): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = []
  if (filters.search) {
    const pattern = new RegExp(escapeForSearch(filters.search), "i")
    conditions.push({ $or: [{ "topic.title": pattern }, { "topic.why_trending": pattern }] })
  }
  if (filters.category) conditions.push({ "topic.category": categoryPattern(filters.category) })
  if (filters.format === NO_FORMAT_FILTER) {
    conditions.push({ $or: [{ "topic.post_format": null }, { "topic.post_format": { $exists: false } }] })
  } else if (filters.format) {
    conditions.push({ "topic.post_format": filters.format })
  }
  return conditions.length > 0 ? { $and: conditions } : {}
}

/**
 * One page of saved topics, newest search first and each search's topics in their ranked order.
 * Never more than HISTORY_PAGE_SIZE, and a page past the end comes back as the last page
 * rather than as nothing.
 */
export async function listSavedTopics(viewer: Viewer, filters: SavedTopicFilters): Promise<SavedTopicsPage> {
  await connectDatabase()
  const currentId = await currentSearchId(viewer)
  const pageSize = HISTORY_PAGE_SIZE

  const unwound: PipelineStage[] = [
    { $match: searchConditions(viewer, filters, currentId) },
    { $project: { searchedAt: 1, dismissedAt: 1, topic: "$result.topics" } },
    { $unwind: { path: "$topic", includeArrayIndex: "rank" } },
    { $match: topicConditions(filters) },
  ]

  const [counted] = await TrendingSearch.aggregate<{ total: number }>([...unwound, { $count: "total" }])
  const total = counted?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, filters.page), totalPages)

  const [rows, categories] = await Promise.all([
    TrendingSearch.aggregate<TopicRow>([
      ...unwound,
      { $sort: { searchedAt: -1, _id: -1, rank: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
    ]),
    listCategories(viewer),
  ])

  return {
    items: rows.map((row) => toSavedTopic(row, currentId)),
    page,
    pageSize,
    total,
    totalPages,
    categories,
  }
}

/**
 * Every category label any saved topic uses, split out of the lists some topics carry, so the
 * filter offers "AI Tools" once rather than every combination it appeared in.
 */
async function listCategories(viewer: Viewer): Promise<string[]> {
  const rows = await TrendingSearch.aggregate<{ _id: string }>([
    { $match: { topicCount: { $gt: 0 }, ...visibleTo(viewer) } },
    { $unwind: "$result.topics" },
    { $group: { _id: "$result.topics.category" } },
  ])
  const labels = rows
    .flatMap((row) => (typeof row._id === "string" ? row._id.split(",") : []))
    .map((label) => label.trim())
    .filter(Boolean)
  return [...new Map(labels.map((label) => [label.toLowerCase(), label])).values()].sort((a, b) => a.localeCompare(b))
}

/**
 * One saved topic in full, for its own view. A topic is named by its search and its title: titles
 * are unique within a search, and unlike its place in the list a title does not move when another
 * topic of the same search is deleted. A viewer only reaches the searches they may see.
 */
export async function getSavedTopic(viewer: Viewer, searchId: string, title: string): Promise<SavedTopicDetail | null> {
  const filter = visibleById(viewer, searchId)
  if (!filter) return null
  await connectDatabase()
  const search = await TrendingSearch.findOne({ ...filter, "result.topics.title": title }, { result: 1, searchedAt: 1, dismissedAt: 1 }).lean()
  const topics = (search?.result as { topics?: unknown } | undefined)?.topics
  if (!search || !Array.isArray(topics)) return null

  const index = topics.findIndex((topic) => (topic as { title?: unknown } | null)?.title === title)
  if (index < 0) return null
  const parsed = StoredTrendingTopicSchema.safeParse(topics[index])
  if (!parsed.success) throw new UserFacingError(TRENDING_HISTORY_MESSAGES.unreadable)

  return {
    searchId,
    rank: index + 1,
    searchedAt: new Date(search.searchedAt).toISOString(),
    status: statusOf(searchId, search.dismissedAt, await currentSearchId(viewer)),
    topic: parsed.data,
  }
}

/**
 * Deletes one topic from the search it belongs to, in one atomic update: the topic leaves the
 * search's saved result and the search's topic count goes down with it. Nothing is read first and
 * written back, so a search that changes in between can't lose another topic. The search itself
 * is kept, like every search; one with no topics left simply shows nowhere. Only a search the
 * viewer may see can be changed, the same rule as every other delete in the app.
 */
export async function deleteSavedTopic(viewer: Viewer, searchId: string, title: string): Promise<boolean> {
  const filter = visibleById(viewer, searchId)
  if (!filter) return false
  await connectDatabase()
  const topics = "$result.topics"
  const at = { $indexOfArray: [`${topics}.title`, title] }
  const { modifiedCount } = await TrendingSearch.updateOne(
    { ...filter, "result.topics.title": title },
    [
      {
        $set: {
          "result.topics": {
            $concatArrays: [{ $slice: [topics, at] }, { $slice: [topics, { $add: [at, 1] }, { $size: topics }] }],
          },
          topicCount: { $max: [0, { $subtract: ["$topicCount", 1] }] },
        },
      },
    ],
    { updatePipeline: true }
  )
  return modifiedCount > 0
}
