import { z } from "zod"
import { TRENDING_POST_FORMAT_IDS, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import type { SearchProvider as ResearchProvider } from "@/services/liveResearch"
import type { PromptBook } from "@/services/promptBook"

const DiscussionPotentialSchema = z.enum(["High", "Medium", "Emerging"])
const ConfidenceSchema = z.enum(["high", "medium", "low"])
const PostFormatSchema = z.enum(TRENDING_POST_FORMAT_IDS)

const modelReferenceSchema = (book: PromptBook) =>
  z.object({
    title: z.string(),
    url: z.string().describe(book.text("synthesis.field.reference-url")),
    source: z.string().describe(book.text("synthesis.field.reference-source")),
  })

/**
 * Shape requested from the ranking model. OpenAI strict structured output needs every
 * field present, so optional values are nullable and limits are enforced after parsing. What each
 * field means is the Trending instructions prompt's, so the schema is built from it.
 */
export const synthesisOutputSchema = (book: PromptBook) => {
  const reference = modelReferenceSchema(book)
  return z.object({
    candidates_evaluated: z.number().describe(book.text("synthesis.field.candidates-evaluated")),
    shortfall_reason: z.string().nullable().describe(book.text("synthesis.field.shortfall-reason")),
    topics: z.array(
      z.object({
        rank: z.number().describe(book.text("synthesis.field.rank")),
        title: z.string(),
        category: z.string(),
        event_date: z.string().nullable().describe(book.text("synthesis.field.event-date")),
        why_trending: z.string(),
        linkedin_angle: z.string().describe(book.text("synthesis.field.linkedin-angle")),
        discussion_potential: DiscussionPotentialSchema,
        discussion_basis: z.string().describe(book.text("synthesis.field.discussion-basis")),
        confidence: ConfidenceSchema,
        linkedin_search_queries: z.array(z.string()),
        keywords: z.array(z.string()),
        suggested_hashtags: z.array(z.string()),
        post_format: PostFormatSchema.describe(book.text("synthesis.field.post-format")),
        hook_style: z.string().describe(book.text("synthesis.field.hook-style")),
        post_hook: z.string().describe(book.text("synthesis.field.post-hook")),
        post_body: z.string().describe(book.text("synthesis.field.post-body")),
        post_cta: z.string().describe(book.text("synthesis.field.post-cta")),
        primary_reference: reference,
        secondary_references: z.array(reference),
        screenshot_reference: z.object({
          url: z.string().describe(book.text("synthesis.field.reference-url")),
          description: z.string(),
        }),
      })
    ),
  })
}

const HttpUrlSchema = z.url({ protocol: /^https?$/ })

const ReferenceSchema = z.object({
  title: z.string().min(1),
  url: HttpUrlSchema,
  source: z.string(),
})

export const TrendingTopicSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  freshness: z.string().min(1),
  event_date: z.string().nullable(),
  why_trending: z.string().min(1),
  linkedin_angle: z.string(),
  discussion_potential: DiscussionPotentialSchema,
  discussion_basis: z.string(),
  confidence: ConfidenceSchema,
  linkedin_search_queries: z.array(z.string().min(1)).min(1).max(6),
  keywords: z.array(z.string().min(1)).max(8),
  suggested_hashtags: z.array(z.string().regex(/^#\S+$/)).max(5),
  post_format: PostFormatSchema,
  post_hook: z.string().min(1),
  post_body: z.string().min(1),
  post_cta: z.string().min(1),
  primary_reference: ReferenceSchema,
  secondary_references: z.array(ReferenceSchema).max(3),
  screenshot_reference: z.object({ url: HttpUrlSchema, description: z.string() }),
})

export const TrendingResultSchema = z.object({
  topics: z.array(TrendingTopicSchema).max(TRENDING_TOPIC_COUNT),
  notice: z.string().nullable(),
  research_metadata: z.object({
    searched_at: z.string(),
    // Who searched; a string rather than today's providers, so searches saved by an earlier provider still read back
    search_provider: z.string(),
    sources_checked: z.number().int().nonnegative(),
    candidates_evaluated: z.number().int().nonnegative(),
  }),
  // Who wrote the topics (the last provider that answered) and every provider that answered; searches saved before this have neither
  provider: z.string().nullable().optional(),
  providers: z.array(z.string()).optional(),
})

export type SynthesisOutput = z.infer<ReturnType<typeof synthesisOutputSchema>>
export type SynthesisTopic = SynthesisOutput["topics"][number]
export type TrendingTopic = z.infer<typeof TrendingTopicSchema>

/**
 * A topic as it was saved, read back for the saved topics. Searches from before posts had a format
 * carry no format, no LinkedIn angle and no closing line, so those three are allowed to be missing;
 * everything else is held to the same schema as a new result.
 */
export const StoredTrendingTopicSchema = TrendingTopicSchema.extend({
  post_format: TrendingTopicSchema.shape.post_format.nullable().catch(null),
  linkedin_angle: z.string().catch(""),
  post_cta: z.string().catch(""),
})
export type StoredTrendingTopic = z.infer<typeof StoredTrendingTopicSchema>
export type TrendingReference = TrendingTopic["primary_reference"]
export type TrendingResult = z.infer<typeof TrendingResultSchema>
export type SearchProvider = ResearchProvider

export type TrendingStage = "RESEARCHING" | "FALLBACK" | "RANKING" | "VERIFYING" | "EXPANDING" | "HUMANIZING"

export type TrendingStreamEvent =
  | { status: TrendingStage; text: string }
  | { status: "COMPLETE"; result: TrendingResult }
  | { status: "ERROR"; message: string }
