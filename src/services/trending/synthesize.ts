import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import {
  POST_HASHTAG_MAX,
  POST_HASHTAG_MIN,
  POST_TARGET_MAX_CHARS,
  POST_TARGET_MIN_CHARS,
  TRENDING_POST_FORMATS,
  TRENDING_CANDIDATE_COUNT,
  TRENDING_TOPIC_COUNT,
} from "@/constants/trending"
import { SynthesisOutputSchema, type SynthesisOutput } from "./schema"
import type { ResearchResult } from "@/services/liveResearch"
import { sanitizeForTag } from "./sanitize"

// Six topics with posts is a long structured answer
const SYNTHESIS_TIMEOUT_MS = 90_000
// Slightly above the project default so the posts don't read alike
const SYNTHESIS_TEMPERATURE = 0.4
const MAX_RESEARCH_CHARS = 40_000
const MAX_LISTED_SOURCES = 60

/**
 * The formats the prompt assigns by rank, listed from constants/trending.ts so the prompt and
 * the app can never disagree about what a format means.
 */
const POST_FORMATS = TRENDING_POST_FORMATS.map(
  (format, index) => `${index + 1}. ${format.id} (${format.label}). ${format.structure}`
).join("\n")

interface SynthesisOptions {
  brief: string
  research: ResearchResult
  now: Date
  signal: AbortSignal
}

/**
 * One structured model call that ranks the researched candidates and writes the
 * LinkedIn-ready fields, keeping system rules, the configured prompt and untrusted
 * web research in separate, clearly delimited sections.
 */
export async function synthesizeTopics({ brief, research, now, signal }: SynthesisOptions): Promise<SynthesisOutput> {
  const system = renderPrompt(await loadPrompt("trending-synthesis"), {
    CURRENT_DATE: now.toISOString().slice(0, 10),
    TOPIC_COUNT: TRENDING_CANDIDATE_COUNT,
    PUBLISH_COUNT: TRENDING_TOPIC_COUNT,
    POST_FORMATS,
    POST_MIN_CHARS: POST_TARGET_MIN_CHARS,
    POST_MAX_CHARS: POST_TARGET_MAX_CHARS,
    HASHTAG_MIN: POST_HASHTAG_MIN,
    HASHTAG_MAX: POST_HASHTAG_MAX,
  })

  const sourceList = research.sources
    .slice(0, MAX_LISTED_SOURCES)
    .map((source) => `- ${sanitizeForTag(source.title)} | ${source.url}`)
    .join("\n")

  const user = [
    `<configured_prompt>\n${sanitizeForTag(brief)}\n</configured_prompt>`,
    `<untrusted_research_data>\n${sanitizeForTag(research.notes.slice(0, MAX_RESEARCH_CHARS))}\n</untrusted_research_data>`,
    `<verified_source_urls>\n${sourceList}\n</verified_source_urls>`,
  ].join("\n\n")

  const { data } = await generateStructuredWithFallback({
    schema: SynthesisOutputSchema,
    name: "trending_topics",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: SYNTHESIS_TEMPERATURE,
    timeoutMs: SYNTHESIS_TIMEOUT_MS,
    signal,
  })
  return data
}
