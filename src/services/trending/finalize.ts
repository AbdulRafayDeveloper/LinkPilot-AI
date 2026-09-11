import { TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { ResearchResult, ResearchSource } from "@/services/liveResearch"
import { hostnameOf, normalizeUrl } from "@/lib/url"
import { daysSince, verifyEventDate } from "@/lib/eventDate"
import type { SynthesisTopic, TrendingReference, TrendingTopic } from "./schema"

const MAX_SEARCH_QUERIES = 6
const MAX_KEYWORDS = 8
const MAX_HASHTAGS = 6
const MAX_SECONDARY_REFERENCES = 3
// Hard ceiling for anything presented as "trending"; the configured prompt sets the tighter window
const MAX_TOPIC_AGE_DAYS = 30

export type RejectionReason = "unverified_source" | "unverified_date" | "incomplete" | "duplicate"

export interface FinalizedTopics {
  topics: TrendingTopic[]
  rejected: Array<{ title: string; reason: RejectionReason }>
}

function cleanList(values: string[], max: number, format: (value: string) => string = (value) => value): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const value = format(raw.trim())
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    result.push(value)
    if (result.length === max) break
  }
  return result
}

function toHashtag(value: string): string {
  const tag = value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")
  return tag ? `#${tag}` : ""
}

/**
 * Freshness is derived from the verified event date, never from the model's own wording.
 */
function describeFreshness(eventDate: string, now: Date): string {
  const days = Math.max(0, daysSince(eventDate, now))
  if (days === 0) return "Today"
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/**
 * Keeps only references whose URL was actually returned by the live search, so the
 * model cannot introduce unverified or invented links.
 */
function verifyReferences(topic: SynthesisTopic, verifiedUrls: Map<string, ResearchSource>): TrendingReference[] {
  const seen = new Set<string>()
  const verified: TrendingReference[] = []
  for (const reference of [topic.primary_reference, ...topic.secondary_references]) {
    const url = normalizeUrl(reference.url)
    const source = url ? verifiedUrls.get(url) : undefined
    if (!url || !source || seen.has(url)) continue
    seen.add(url)
    verified.push({
      url,
      title: reference.title.trim() || source.title,
      source: reference.source.trim() || hostnameOf(url),
    })
  }
  return verified
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

/**
 * Validates and normalizes model output: source and date verification, freshness,
 * list limits, deduplication of the same event, and the final topic cap.
 */
export function finalizeTopics(modelTopics: SynthesisTopic[], research: ResearchResult, now: Date): FinalizedTopics {
  const verifiedUrls = new Map(research.sources.map((source) => [source.url, source]))
  const notes = research.notes.toLowerCase()
  const seenEvents = new Set<string>()
  const topics: TrendingTopic[] = []
  const rejected: FinalizedTopics["rejected"] = []

  for (const topic of [...modelTopics].sort((a, b) => a.rank - b.rank)) {
    const title = topic.title.trim()
    const reject = (reason: RejectionReason) => rejected.push({ title, reason })
    const references = verifyReferences(topic, verifiedUrls)
    const queries = cleanList(topic.linkedin_search_queries, MAX_SEARCH_QUERIES)
    const [primary, ...secondary] = references

    if (!primary) {
      reject("unverified_source")
      continue
    }
    const evidence = `${notes}\n${references.map((reference) => reference.url.toLowerCase()).join("\n")}`
    // The date must be stated by the live research (report text or the topic's verified source URLs)
    const eventDate = verifyEventDate(topic.event_date, now, evidence, MAX_TOPIC_AGE_DAYS)
    if (!eventDate) {
      reject("unverified_date")
      continue
    }
    if (!title || queries.length === 0 || !topic.short_post.trim()) {
      reject("incomplete")
      continue
    }

    const eventKeys = [primary.url, titleKey(title)]
    if (eventKeys.some((key) => seenEvents.has(key))) {
      reject("duplicate")
      continue
    }
    eventKeys.forEach((key) => seenEvents.add(key))

    const screenshotUrl = normalizeUrl(topic.screenshot_reference.url)
    // "high" means official plus independent coverage, which needs at least two verified sources
    const confidence = topic.confidence === "high" && secondary.length === 0 ? "medium" : topic.confidence

    topics.push({
      title,
      category: topic.category.trim() || "Technology",
      freshness: describeFreshness(eventDate, now),
      event_date: eventDate,
      why_trending: topic.why_trending.trim(),
      discussion_potential: topic.discussion_potential,
      discussion_basis: topic.discussion_basis.trim(),
      confidence,
      linkedin_search_queries: queries,
      keywords: cleanList(topic.keywords, MAX_KEYWORDS),
      suggested_hashtags: cleanList(topic.suggested_hashtags, MAX_HASHTAGS, toHashtag),
      conversation_angle: topic.conversation_angle.trim(),
      short_post: topic.short_post.trim(),
      primary_reference: primary,
      secondary_references: secondary.slice(0, MAX_SECONDARY_REFERENCES),
      screenshot_reference: {
        url: screenshotUrl && verifiedUrls.has(screenshotUrl) ? screenshotUrl : primary.url,
        description: topic.screenshot_reference.description.trim() || "Official announcement headline",
      },
    })

    if (topics.length === TRENDING_TOPIC_COUNT) break
  }

  return { topics, rejected }
}
