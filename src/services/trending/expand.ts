import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
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

const ExpandedPostSchema = z.object({
  post_hook: z
    .string()
    .describe(`The first line, at most ${POST_HOOK_MAX_WORDS} words. Return it unchanged unless you were asked to change it`),
  post_body: z
    .string()
    .describe(
      "The rewritten body, 250 to 320 words, keeping the same facts and the same format shape, with blank lines between short paragraphs. No links, no hashtags"
    ),
  post_cta: z
    .string()
    .describe(
      "The closing line, one sentence naming the specific choice this post is about, so a reader can answer it from their own work. No links, no hashtags"
    ),
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

const SYSTEM = [
  "You rewrite one LinkedIn post that came out too thin to travel.",
  "",
  `Rewrite its body to 250 to 320 words, so the finished post lands between ${POST_TARGET_MIN_CHARS} and ${POST_TARGET_MAX_CHARS} characters. Most drafts are half that, so this is the main job.`,
  "",
  "Rules",
  "- Add real substance, not padding. Use the detail in the research report, so what changed, what it costs, who it affects, what breaks and what to do about it.",
  "- Give every block of the post's format its own 2 or 3 lines. That is where the missing length comes from.",
  "- Never add a fact, a number, a date, a company or a result the research report does not state. Never invent the writer's own experience, clients or projects.",
  "- Keep the shape of the post's own format.",
  "- Short paragraphs of 1 or 2 lines with a blank line between them.",
  "- The closing line asks one question that names the specific choice in this post, so a reader can answer it from their own work. Never end with what do you think, thoughts, do you agree, how do you see this, or what tools do you use.",
  "- No links, no hashtags, and no source lines anywhere in the post.",
  "- Never name LinkedIn in the post. The reader is already there.",
  "- The body never ends on a question. The closing line is the only question in the post.",
  "",
  "HUMAN STYLE (STRICT, NEVER BREAK THIS)",
  "- Never use an em dash, an en dash, a colon or a semicolon. End the sentence and start a new one instead.",
  "- Never use AI-sounding words such as seamless, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry or fast-paced.",
  "- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.",
].join("\n")

function buildRequest(topic: TrendingTopic, problems: PostProblems, researchNotes: string): string {
  const format = getPostFormat(topic.post_format)
  const jobs = [
    problems.wrongFormat
      ? `This body was written in a different shape and now has to be a ${format.label}. Rebuild it to that shape, keeping the same facts.`
      : null,
    problems.isShort ? `The body is only ${postLength(topic)} characters long. Make it 250 to 320 words.` : null,
    problems.hasGenericEnding ? "The closing line asks nothing specific. Replace it." : null,
    problems.aiWords.length > 0
      ? `Replace these AI-sounding words with plain ones. ${problems.aiWords.join(", ")}.`
      : null,
    problems.cliches.length > 0
      ? `Cut these stock phrases and say the specific thing instead. ${problems.cliches.join(", ")}.`
      : null,
    problems.talksAboutLinkedIn
      ? "The post talks about LinkedIn itself. The reader is already there, so write about the development and what it means for their work instead, and never name the platform."
      : null,
    problems.needsStatementHook
      ? "Another post in this set already opens on a question, so rewrite this hook as a statement that makes the same point."
      : null,
    problems.takenOpeners.length > 0
      ? [
          `Another post in this set already opens with the same word, so this hook has to start somewhere else.`,
          `These opening words are taken and none of them may be the first word. ${problems.takenOpeners.join(", ")}.`,
          `Start on a verb, a number, the specific product or company name, or the thing at stake. Keep the same meaning and stay at most ${POST_HOOK_MAX_WORDS} words.`,
        ].join(" ")
      : "Return the hook exactly as it is.",
  ].filter(Boolean)

  return [
    `<research_report>\n${sanitizeForTag(researchNotes.slice(0, MAX_RESEARCH_CHARS))}\n</research_report>`,
    `<post format="${format.label}">`,
    `Format shape to follow. ${format.structure}`,
    `Hook. ${sanitizeForTag(topic.post_hook)}`,
    `Body. ${sanitizeForTag(topic.post_body)}`,
    `Closing line. ${sanitizeForTag(topic.post_cta)}`,
    "</post>",
    `What to fix.\n${jobs.map((job) => `- ${job}`).join("\n")}`,
  ].join("\n\n")
}

/**
 * Rewrites one post. Returns the improved topic, or null when the rewrite came back worse or
 * broke a rule, so a post can only ever get better here.
 */
async function rewritePost(
  topic: TrendingTopic,
  problems: PostProblems,
  researchNotes: string,
  signal: AbortSignal
): Promise<TrendingTopic | null> {
  const result = await generateStructuredWithFallback({
    schema: ExpandedPostSchema,
    name: "expanded_trending_post",
    messages: [new SystemMessage(SYSTEM), new HumanMessage(buildRequest(topic, problems, researchNotes))],
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
          batch.map(({ index, problems }) => rewritePost(current[index], problems, researchNotes, signal))
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
