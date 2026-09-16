import { z } from "zod"
import { TRENDING_POST_FORMAT_IDS, TRENDING_TOPIC_COUNT } from "@/constants/trending"
import { SEARCH_PROVIDERS } from "@/services/liveResearch"

const DiscussionPotentialSchema = z.enum(["High", "Medium", "Emerging"])
const ConfidenceSchema = z.enum(["high", "medium", "low"])
const PostFormatSchema = z.enum(TRENDING_POST_FORMAT_IDS)

const ModelReferenceSchema = z.object({
  title: z.string(),
  url: z.string().describe("Copied exactly from the verified source URL list"),
  source: z.string().describe("Publisher or site name"),
})

/**
 * Shape requested from the ranking model. OpenAI strict structured output needs every
 * field present, so optional values are nullable and limits are enforced after parsing.
 */
export const SynthesisOutputSchema = z.object({
  candidates_evaluated: z.number().describe("Number of distinct candidate developments evaluated before ranking"),
  shortfall_reason: z
    .string()
    .nullable()
    .describe("Why fewer topics than requested qualified, or null when the full set qualified"),
  topics: z.array(
    z.object({
      rank: z.number().describe("1 is the strongest topic"),
      title: z.string(),
      category: z.string(),
      event_date: z.string().nullable().describe("YYYY-MM-DD as stated in the research, or null"),
      why_trending: z.string(),
      linkedin_angle: z
        .string()
        .describe("What people on LinkedIn are actually saying or arguing about this, from the research"),
      discussion_potential: DiscussionPotentialSchema,
      discussion_basis: z.string().describe("Research signals behind the discussion assessment, without invented metrics"),
      confidence: ConfidenceSchema,
      linkedin_search_queries: z.array(z.string()),
      keywords: z.array(z.string()),
      suggested_hashtags: z.array(z.string()),
      post_format: PostFormatSchema.describe("The assigned post format for this rank; every topic uses a different one"),
      hook_style: z
        .string()
        .describe('The hook technique for this topic\'s post, e.g. "Contrarian take". Techniques must differ across topics.'),
      post_hook: z.string().describe("Scroll-stopping first line of the post, at most 12 words, following hook_style"),
      post_body: z
        .string()
        .describe(
          "The body under the hook, in the assigned format, with blank lines between short paragraphs. Long enough that the whole post reaches 1200 to 2000 characters. No links, no hashtags"
        ),
      post_cta: z
        .string()
        .describe("The closing line that asks for replies, one sentence, usually a question. No links, no hashtags"),
      primary_reference: ModelReferenceSchema,
      secondary_references: z.array(ModelReferenceSchema),
      screenshot_reference: z.object({
        url: z.string().describe("Copied exactly from the verified source URL list"),
        description: z.string(),
      }),
    })
  ),
})

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
    search_provider: z.enum(SEARCH_PROVIDERS),
    sources_checked: z.number().int().nonnegative(),
    candidates_evaluated: z.number().int().nonnegative(),
  }),
})

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>
export type SynthesisTopic = SynthesisOutput["topics"][number]
export type TrendingTopic = z.infer<typeof TrendingTopicSchema>
export type TrendingReference = TrendingTopic["primary_reference"]
export type TrendingResult = z.infer<typeof TrendingResultSchema>
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]

export type TrendingStage = "RESEARCHING" | "FALLBACK" | "RANKING" | "VERIFYING" | "EXPANDING" | "HUMANIZING"

export type TrendingStreamEvent =
  | { status: TrendingStage; text: string }
  | { status: "COMPLETE"; result: TrendingResult }
  | { status: "ERROR"; message: string }
