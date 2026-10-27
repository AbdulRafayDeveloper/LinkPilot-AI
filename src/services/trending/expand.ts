import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import {
  cleanPostText,
  composeTrendingPost,
  stripPostHashtags,
  stripPostLinks,
  tidyPostBody,
} from "@/lib/trendingPost"
import { findAiWords } from "@/lib/humanStyle"
import {
  POST_HOOK_MAX_WORDS,
  POST_TARGET_MAX_CHARS,
  POST_TARGET_MIN_CHARS,
  getPostFormat,
} from "@/constants/trending"
import { sanitizeForTag } from "./sanitize"
import type { TrendingTopic } from "./schema"

// Rewriting to length is close to copy editing, so it stays near the writing temperature
const EXPAND_TEMPERATURE = 0.6
// A long body on the backup model can take a while, and a timeout is never retried, so the
// post it belongs to would stay short
const EXPAND_TIMEOUT_MS = 90_000
const MAX_RESEARCH_CHARS = 16_000
// Models undershoot the length and cling to an opening word, so anything still wrong is retried
const MAX_ROUNDS = 3
// Six rewrites fired at once run into the provider rate limit, and a call that fails leaves
// that post short, so they go out a few at a time
const MAX_PARALLEL_REWRITES = 3
// Endings that ask for nothing in particular, which is what a post gets no comments for
const GENERIC_CTA =
  /\bwhat do you think\b|\bthoughts\b|\bdo you agree\b|\bhow do you (?:see|think)\b|\bwhat .{0,25}tools (?:are|do) you\b|\bhow are you planning\b|\blet me know\b|\bcurious to hear\b|\bwhat .{0,25}could be automated\b|\bmost excited\b|\bcaught your (?:eye|attention)\b|\bwhat steps are you taking\b|\bare you (?:excited|looking forward)\b/i
// The reader is already on LinkedIn, so a post about LinkedIn reads like a report on the feed
const MENTIONS_LINKEDIN = /\blinkedin\b/i
// Stock phrases that make a post sound like every other post in the feed
const CLICHES =
  /\bchanged the (?:\w+ )?game\b|\bgame changer\b|\bin a world where\b|\bin today[’']s (?:\w+ )?world\b|\bthe future is here\b|\bexciting times\b|\bat the end of the day\b|\btime is money\b|\bspeed is key\b|\btake it to the next level\b/gi

function findCliches(text: string): string[] {
  return [...new Set((text.match(CLICHES) ?? []).map((phrase) => phrase.toLowerCase()))]
}

// What each field means is the Trending instructions prompt's, so the schema is built from it
const expandedPostSchema = (book: PromptBook) =>
  z.object({
    post_hook: z.string().describe(book.text("expand.field.hook", { max: POST_HOOK_MAX_WORDS })),
    post_body: z.string().describe(book.text("expand.field.body")),
    post_cta: z.string().describe(book.text("expand.field.cta")),
  })

// Links and inline hashtags are taken out rather than thrown away with the whole rewrite
const clean = (text: string) => stripPostHashtags(stripPostLinks(cleanPostText(text)))
const postLength = (topic: TrendingTopic) => composeTrendingPost(topic).length
const firstWord = (hook: string) => hook.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ?? ""
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

interface PostProblems {
  isShort: boolean
  hasGenericEnding: boolean
  // First words used by the topics above this one, which this hook may not reuse
  takenOpeners: string[]
  // AI-sounding words with no safe automatic swap, so only a rewrite removes them
  aiWords: string[]
  cliches: string[]
  talksAboutLinkedIn: boolean
  // Written in one format and published under another, so the body has to be rebuilt to match
  wrongFormat: boolean
  // A set where every hook asks something reads as a quiz, so only the first one may
  needsStatementHook: boolean
}

const postText = (topic: TrendingTopic) => [topic.post_hook, topic.post_body, topic.post_cta].join("\n")

function findProblems(
  topic: TrendingTopic,
  takenOpeners: string[],
  wrongFormat: boolean,
  questionHookTaken: boolean
): PostProblems | null {
  const problems: PostProblems = {
    isShort: postLength(topic) < POST_TARGET_MIN_CHARS,
    hasGenericEnding: GENERIC_CTA.test(topic.post_cta),
    takenOpeners: takenOpeners.includes(firstWord(topic.post_hook)) ? takenOpeners : [],
    aiWords: findAiWords(postText(topic)),
    cliches: findCliches(postText(topic)),
    talksAboutLinkedIn: MENTIONS_LINKEDIN.test(postText(topic)),
    wrongFormat,
    needsStatementHook: questionHookTaken && topic.post_hook.includes("?"),
  }
  const needsWork =
    problems.isShort ||
    problems.hasGenericEnding ||
    problems.takenOpeners.length > 0 ||
    problems.aiWords.length > 0 ||
    problems.cliches.length > 0 ||
    problems.talksAboutLinkedIn ||
    problems.wrongFormat ||
    problems.needsStatementHook
  return needsWork ? problems : null
}

// What to rewrite and why, in the words of the Trending instructions prompt
function buildRequest(topic: TrendingTopic, problems: PostProblems, researchNotes: string, book: PromptBook): string {
  const format = getPostFormat(topic.post_format)
  const jobs = [
    problems.wrongFormat ? book.text("expand.job.wrong-format", { format: format.label }) : null,
    problems.isShort ? book.text("expand.job.short", { length: postLength(topic) }) : null,
    problems.hasGenericEnding ? book.text("expand.job.generic-ending") : null,
    problems.aiWords.length > 0 ? book.text("expand.job.ai-words", { words: problems.aiWords.join(", ") }) : null,
    problems.cliches.length > 0 ? book.text("expand.job.cliches", { phrases: problems.cliches.join(", ") }) : null,
    problems.talksAboutLinkedIn ? book.text("expand.job.linkedin") : null,
    problems.needsStatementHook ? book.text("expand.job.statement-hook") : null,
    problems.takenOpeners.length > 0
      ? book.text("expand.job.taken-openers", { openers: problems.takenOpeners.join(", "), max: POST_HOOK_MAX_WORDS })
      : book.text("expand.job.keep-hook"),
  ].filter(Boolean)

  return book.text("expand.request", {
    research: sanitizeForTag(researchNotes.slice(0, MAX_RESEARCH_CHARS)),
    format: format.label,
    structure: book.text(`format.${format.id}`),
    hook: sanitizeForTag(topic.post_hook),
    body: sanitizeForTag(topic.post_body),
    cta: sanitizeForTag(topic.post_cta),
    jobs: jobs.map((job) => `- ${job}`).join("\n"),
  })
}

/**
 * Rewrites one post. Returns the improved topic, or null when the rewrite came back worse or
 * broke a rule, so a post can only ever get better here.
 */
async function rewritePost(
  topic: TrendingTopic,
  problems: PostProblems,
  researchNotes: string,
  signal: AbortSignal,
  book: PromptBook
): Promise<TrendingTopic | null> {
  const system = book.text("expand.system", { min: POST_TARGET_MIN_CHARS, max: POST_TARGET_MAX_CHARS })
  const result = await generateStructuredWithFallback({
    schema: expandedPostSchema(book),
    name: "expanded_trending_post",
    messages: [new SystemMessage(system), new HumanMessage(buildRequest(topic, problems, researchNotes, book))],
    temperature: EXPAND_TEMPERATURE,
    timeoutMs: EXPAND_TIMEOUT_MS,
    signal,
  }).catch((error: unknown) => {
    if (signal.aborted) throw error
    console.warn("⚠️ Trending post rewrite failed, keeping the draft:", error instanceof Error ? error.message : error)
    return null
  })
  if (!result) return null

  const body = tidyPostBody(clean(result.data.post_body))
  const cta = clean(result.data.post_cta)
  if (!body || !cta) return null
  // The hook is judged on its own. A model that ignored the word limit, or clung to an opening
  // word another post has, loses only its hook, because the longer body is still worth keeping.
  const rewrittenHook = clean(result.data.post_hook)
  const hookIsUsable =
    Boolean(rewrittenHook) &&
    wordCount(rewrittenHook) <= POST_HOOK_MAX_WORDS &&
    !problems.takenOpeners.includes(firstWord(rewrittenHook)) &&
    !(problems.needsStatementHook && rewrittenHook.includes("?"))
  const finalHook = hookIsUsable ? rewrittenHook : topic.post_hook

  const candidate = { ...topic, post_hook: finalHook, post_body: body, post_cta: cta }
  // A rewrite that brings in new AI-sounding words or starts talking about the platform is no gain
  if (findAiWords(postText(candidate)).length > problems.aiWords.length) return null
  if (findCliches(postText(candidate)).length > problems.cliches.length) return null
  if (!problems.talksAboutLinkedIn && MENTIONS_LINKEDIN.test(postText(candidate))) return null
  const isLonger = postLength(candidate) > postLength(topic)
  const fixesFormat = problems.wrongFormat
  const fixesEnding = problems.hasGenericEnding && !GENERIC_CTA.test(cta)
  const fixesOpener = problems.takenOpeners.length > 0 && hookIsUsable
  const fixesHookQuestion = problems.needsStatementHook && hookIsUsable
  const fixesWords =
    findAiWords(postText(candidate)).length < problems.aiWords.length ||
    findCliches(postText(candidate)).length < problems.cliches.length
  const fixesPlatform = problems.talksAboutLinkedIn && !MENTIONS_LINKEDIN.test(postText(candidate))
  return isLonger || fixesEnding || fixesOpener || fixesWords || fixesPlatform || fixesFormat || fixesHookQuestion ? candidate : null
}

/**
 * Posts come back from the writing step shorter than they should be, sometimes ending on a
 * question nobody can answer, and sometimes opening on the same word as another post. Rather
 * than dropping those topics, each one is rewritten on its own (one call per post, in parallel,
 * because a model asked for six long bodies at once writes six short ones), for as many rounds
 * as anything is still wrong. It runs again after the humanizer, whose tone rewrite can shorten
 * a post or bring a stock phrase back, so the last word on length and endings is always here.
 */
export async function expandShortPosts(
  topics: TrendingTopic[],
  researchNotes: string,
  signal: AbortSignal,
  maxRounds: number = MAX_ROUNDS,
  reshape: ReadonlySet<number> = new Set()
): Promise<{ topics: TrendingTopic[]; expanded: number }> {
  const current = [...topics]
  const improved = new Set<number>()
  // Read once for the whole run: the system prompt, the request and every line of what to fix
  const book = await loadPromptBook("trending-instructions")

  for (let round = 0; round < maxRounds; round++) {
    // An opening word belongs to the first post that used it; later posts have to move
    const openers: string[] = []
    let questionHookTaken = false
    const pending = current.flatMap((topic, index) => {
      const problems = findProblems(topic, [...openers], round === 0 && reshape.has(index), questionHookTaken)
      openers.push(firstWord(topic.post_hook))
      questionHookTaken = questionHookTaken || topic.post_hook.includes("?")
      return problems ? [{ index, problems }] : []
    })
    if (pending.length === 0) break

    const results: Array<TrendingTopic | null> = []
    for (let start = 0; start < pending.length; start += MAX_PARALLEL_REWRITES) {
      const batch = pending.slice(start, start + MAX_PARALLEL_REWRITES)
      results.push(
        ...(await Promise.all(
          batch.map(({ index, problems }) => rewritePost(current[index], problems, researchNotes, signal, book))
        ))
      )
    }
    let changed = 0
    pending.forEach(({ index }, position) => {
      const rewritten = results[position]
      if (!rewritten) return
      current[index] = rewritten
      improved.add(index)
      changed++
    })
    if (changed === 0) break
  }

  const stillShort = current.filter((topic) => postLength(topic) < POST_TARGET_MIN_CHARS).length
  if (stillShort > 0) {
    console.warn(`⚠️ ${stillShort} trending post(s) are still under ${POST_TARGET_MIN_CHARS} characters`)
  }

  return { topics: current, expanded: improved.size }
}
