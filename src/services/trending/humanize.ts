import { humanizeTexts, type HumanizeField } from "@/services/humanizer"
import type { TrendingTopic } from "./schema"

const HOOK_MAX_WORDS = 12
const BODY_MAX_WORDS = 40
const HOOK_MAX_CHARS = 120
const BODY_MAX_CHARS = 320

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const hookId = (index: number) => `${index + 1}-hook`
const bodyId = (index: number) => `${index + 1}-body`

/**
 * Rewrites every topic's hook and body with the Humanization prompt in one call. A hook
 * stays one scroll-stopping line and a body stays 1–2 lines: neither may grow past its
 * word limit (or past the draft, when the draft was already longer); a rewrite that does
 * keeps that text's draft.
 */
export async function humanizeTopicPosts(
  topics: TrendingTopic[],
  signal: AbortSignal
): Promise<{ topics: TrendingTopic[]; humanized: boolean }> {
  if (topics.length === 0) return { topics, humanized: false }

  const fields: HumanizeField<string>[] = topics.flatMap((topic, index) => [
    {
      id: hookId(index),
      kind: "LinkedIn post hook, the first line people see before \"see more\"",
      text: topic.post_hook,
      maxChars: Math.max(HOOK_MAX_CHARS, topic.post_hook.length),
      singleLine: true,
      rule: `at most ${HOOK_MAX_WORDS} words; keep it bold, specific and scroll-stopping`,
    },
    {
      id: bodyId(index),
      kind: "LinkedIn post body that follows the hook",
      text: topic.post_body,
      maxChars: Math.max(BODY_MAX_CHARS, topic.post_body.length),
      rule: `1-2 short lines, at most ${BODY_MAX_WORDS} words; no links or hashtags`,
    },
  ])

  const wordLimits = new Map(
    topics.flatMap((topic, index) => [
      [hookId(index), Math.max(HOOK_MAX_WORDS, wordCount(topic.post_hook))],
      [bodyId(index), Math.max(BODY_MAX_WORDS, wordCount(topic.post_body))],
    ])
  )
  const { texts, humanized } = await humanizeTexts({
    fields,
    signal,
    validate: (id, text) => {
      const limit = wordLimits.get(id)
      return limit !== undefined && wordCount(text) > limit ? `${id}: over ${limit} words` : null
    },
  })

  return {
    topics: topics.map((topic, index) => ({ ...topic, post_hook: texts[hookId(index)], post_body: texts[bodyId(index)] })),
    humanized,
  }
}
