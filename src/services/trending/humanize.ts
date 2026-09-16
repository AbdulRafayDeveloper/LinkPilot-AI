import { humanizeTexts, type HumanizeField } from "@/services/humanizer"
import { cleanPostText, tidyPostBody } from "@/lib/trendingPost"
import { POST_HOOK_MAX_WORDS, getPostFormat } from "@/constants/trending"
import { LINKEDIN_POST_MAX_CHARS } from "@/constants/linkedinLimits"
import type { TrendingTopic } from "./schema"

const HOOK_MAX_CHARS = 120
const CTA_MAX_CHARS = 200
// A rewrite may tighten the wording, but the body has to keep almost all of its substance
const MIN_BODY_SHARE = 0.9
const URL_PATTERN = /https?:\/\/|www\./i

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const firstWord = (text: string) => text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ?? ""
const hookId = (index: number) => `${index + 1}-hook`
const bodyId = (index: number) => `${index + 1}-body`
const ctaId = (index: number) => `${index + 1}-cta`

/**
 * Rewrites every topic's hook, body and closing line with the Humanization prompt in one call.
 * Each body has to keep the shape of its own post format and stay about as long as the draft,
 * and nothing may gain a link or a hashtag; a rewrite that breaks any of that keeps its draft.
 */
export async function humanizeTopicPosts(
  topics: TrendingTopic[],
  signal: AbortSignal
): Promise<{ topics: TrendingTopic[]; humanized: boolean }> {
  if (topics.length === 0) return { topics, humanized: false }

  const fields: HumanizeField<string>[] = topics.flatMap((topic, index) => {
    const format = getPostFormat(topic.post_format)
    return [
      {
        id: hookId(index),
        kind: 'LinkedIn post hook, the first line people see before "see more"',
        text: topic.post_hook,
        maxChars: Math.max(HOOK_MAX_CHARS, topic.post_hook.length),
        singleLine: true,
        rule: `at most ${POST_HOOK_MAX_WORDS} words; keep it bold, specific and scroll-stopping`,
      },
      {
        id: bodyId(index),
        kind: `LinkedIn post body in the "${format.label}" format`,
        text: topic.post_body,
        maxChars: Math.max(LINKEDIN_POST_MAX_CHARS, topic.post_body.length),
        rule: `keep this shape and roughly this length. ${format.structure} Keep the blank lines between paragraphs. No links and no hashtags`,
      },
      {
        id: ctaId(index),
        kind: "closing line of a LinkedIn post that asks readers to reply",
        text: topic.post_cta,
        maxChars: Math.max(CTA_MAX_CHARS, topic.post_cta.length),
        singleLine: true,
        rule: "one sentence that invites a real answer, not a generic thoughts prompt. No links and no hashtags",
      },
    ]
  })

  const hookWordLimits = new Map(
    topics.map((topic, index) => [hookId(index), Math.max(POST_HOOK_MAX_WORDS, wordCount(topic.post_hook))])
  )
  const bodyFloors = new Map(topics.map((topic, index) => [bodyId(index), topic.post_body.length * MIN_BODY_SHARE]))
  // Six hooks opening on the same word make the set look like one post six times, so a rewrite
  // may not move a hook onto an opening word another topic already uses
  const draftQuestions = new Set(
    topics.flatMap((topic, index) => (topic.post_hook.includes("?") ? [hookId(index)] : []))
  )
  const draftOpeners = new Map(topics.map((topic, index) => [hookId(index), firstWord(topic.post_hook)]))
  const hookOpeners = new Map(
    topics.map((topic, index) => [
      hookId(index),
      topics.filter((_, other) => other !== index).map((other) => firstWord(other.post_hook)),
    ])
  )

  const { texts, humanized } = await humanizeTexts({
    fields,
    signal,
    validate: (id, text) => {
      if (text.includes("#")) return `${id}: hashtags belong at the end of the post, not here`
      if (URL_PATTERN.test(text)) return `${id}: a link in the post costs it reach, so leave it out`
      const hookLimit = hookWordLimits.get(id)
      if (hookLimit !== undefined && wordCount(text) > hookLimit) return `${id}: over ${hookLimit} words`
      const takenOpeners = hookOpeners.get(id)
      if (takenOpeners && firstWord(text) !== draftOpeners.get(id) && takenOpeners.includes(firstWord(text)))
        return `${id}: another post already opens with "${firstWord(text)}", keep the first word you were given`
      if (takenOpeners && text.includes("?") && !draftQuestions.has(id))
        return `${id}: keep this hook a statement, the set already has its question`
      const floor = bodyFloors.get(id)
      if (floor !== undefined && text.length < floor) return `${id}: too short, keep roughly the draft's length`
      return null
    },
  })

  return {
    topics: topics.map((topic, index) => ({
      ...topic,
      post_hook: cleanPostText(texts[hookId(index)]),
      post_body: tidyPostBody(texts[bodyId(index)]),
      post_cta: cleanPostText(texts[ctaId(index)]),
    })),
    humanized,
  }
}
