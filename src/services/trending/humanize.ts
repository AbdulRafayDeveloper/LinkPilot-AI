import { humanizeTexts, type HumanizeField } from "@/services/humanizer"
import { loadPromptBook } from "@/services/promptBook"
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
  // What each text is, its rule and every check message are the Trending instructions prompt's
  const book = await loadPromptBook("trending-instructions")

  const fields: HumanizeField<string>[] = topics.flatMap((topic, index) => {
    const format = getPostFormat(topic.post_format)
    return [
      {
        id: hookId(index),
        kind: book.text("humanize.kind.hook"),
        text: topic.post_hook,
        maxChars: Math.max(HOOK_MAX_CHARS, topic.post_hook.length),
        singleLine: true,
        rule: book.text("humanize.rule.hook", { max: POST_HOOK_MAX_WORDS }),
      },
      {
        id: bodyId(index),
        kind: book.text("humanize.kind.body", { format: format.label }),
        text: topic.post_body,
        maxChars: Math.max(LINKEDIN_POST_MAX_CHARS, topic.post_body.length),
        rule: book.text("humanize.rule.body", { structure: book.text(`format.${format.id}`) }),
      },
      {
        id: ctaId(index),
        kind: book.text("humanize.kind.cta"),
        text: topic.post_cta,
        maxChars: Math.max(CTA_MAX_CHARS, topic.post_cta.length),
        singleLine: true,
        rule: book.text("humanize.rule.cta"),
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
      if (text.includes("#")) return book.text("humanize.problem.hashtags", { id })
      if (URL_PATTERN.test(text)) return book.text("humanize.problem.link", { id })
      const hookLimit = hookWordLimits.get(id)
      if (hookLimit !== undefined && wordCount(text) > hookLimit) return book.text("humanize.problem.hook-words", { id, max: hookLimit })
      const takenOpeners = hookOpeners.get(id)
      if (takenOpeners && firstWord(text) !== draftOpeners.get(id) && takenOpeners.includes(firstWord(text)))
        return book.text("humanize.problem.opener", { id, word: firstWord(text) })
      if (takenOpeners && text.includes("?") && !draftQuestions.has(id)) return book.text("humanize.problem.statement", { id })
      const floor = bodyFloors.get(id)
      if (floor !== undefined && text.length < floor) return book.text("humanize.problem.too-short", { id })
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
