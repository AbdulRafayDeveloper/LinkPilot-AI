import {
  POST_UNUSABLE_CHARS,
  TRENDING_POST_FORMAT_IDS,
  TRENDING_TOPIC_COUNT,
  type TrendingPostFormatId,
} from "@/constants/trending"
import { cleanPostText, composeTrendingPost, stripPostLinks, tidyPostBody } from "@/lib/trendingPost"
import type { ResearchResult, ResearchSource } from "@/services/liveResearch"
import { hostnameOf, normalizeUrl } from "@/lib/url"
import { daysSince, verifyEventDate } from "@/lib/eventDate"
import { containsPlaceholder } from "@/lib/generatedText"
import type { SynthesisTopic, TrendingReference, TrendingTopic } from "./schema"

const MAX_SEARCH_QUERIES = 6
const MAX_KEYWORDS = 8
const MAX_HASHTAGS = 5
const MAX_SECONDARY_REFERENCES = 3
// Hard ceiling for anything presented as "trending"; the configured prompt sets the tighter window
const MAX_TOPIC_AGE_DAYS = 30

export type RejectionReason = "unverified_source" | "unverified_date" | "incomplete" | "duplicate" | "weak_post"

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
 * One format per topic, in rank order, so the six posts never read alike. The model's own
 * choice is kept while it is still free; otherwise the next unused format takes its place.
 */
function assignFormat(requested: TrendingPostFormatId, used: Set<TrendingPostFormatId>): TrendingPostFormatId {
  const format = used.has(requested) ? TRENDING_POST_FORMAT_IDS.find((id) => !used.has(id)) ?? requested : requested
  used.add(format)
  return format
}

/**
 * A page's identity without the parts a model gets wrong when copying a URL back: the scheme,
 * a www prefix, the query string and capitalisation of the host.
 */
function pageKey(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
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
    // The page decides the match, not the spelling, so the same article written back with http
    // or with www still resolves. The URL kept is always the verified one, never the model's.
    const source = url ? (verifiedUrls.get(url) ?? verifiedUrls.get(pageKey(url))) : undefined
    if (!source || seen.has(source.url)) continue
    seen.add(source.url)
    verified.push({
      url: source.url,
      title: reference.title.trim() || source.title,
      source: reference.source.trim() || hostnameOf(source.url),
    })
  }
  return verified
}

/**
 * One line of a post as it will be published, with links and markdown marks taken out.
 */
function cleanPostLine(text: string): string {
  return stripPostLinks(cleanPostText(text))
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

/**
 * Validates and normalizes model output: source and date verification, freshness, one post
 * format per topic, links stripped out of the post, list limits, deduplication of the same
 * event, a post long enough to be worth publishing, and the final topic cap.
 */
export function finalizeTopics(modelTopics: SynthesisTopic[], research: ResearchResult, now: Date): FinalizedTopics {
  // Looked up by exact URL first, then by the page it points at
  const verifiedUrls = new Map(research.sources.flatMap((source) => [
    [source.url, source] as const,
    [pageKey(source.url), source] as const,
  ]))
  const notes = research.notes.toLowerCase()
  const seenEvents = new Set<string>()
  const usedFormats = new Set<TrendingPostFormatId>()
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
    const hook = cleanPostLine(topic.post_hook)
    const body = tidyPostBody(stripPostLinks(topic.post_body))
    const cta = cleanPostLine(topic.post_cta)
    // A [bracket] means a pattern was copied instead of filled in
    if (!title || queries.length === 0 || !hook || !body || !cta || containsPlaceholder([hook, body, cta].join("\n"))) {
      reject("incomplete")
      continue
    }

    const hashtags = cleanList(topic.suggested_hashtags, MAX_HASHTAGS, toHashtag)
    const post = composeTrendingPost({ post_hook: hook, post_body: body, post_cta: cta, suggested_hashtags: hashtags })
    // A post this short has nothing to rewrite; anything longer is expanded in the next step
    if (post.length < POST_UNUSABLE_CHARS) {
      reject("weak_post")
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
      linkedin_angle: topic.linkedin_angle.trim(),
      discussion_potential: topic.discussion_potential,
      discussion_basis: topic.discussion_basis.trim(),
      confidence,
      linkedin_search_queries: queries,
      keywords: cleanList(topic.keywords, MAX_KEYWORDS),
      suggested_hashtags: hashtags,
      post_format: assignFormat(topic.post_format, usedFormats),
      post_hook: hook,
      post_body: body,
      post_cta: cta,
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
