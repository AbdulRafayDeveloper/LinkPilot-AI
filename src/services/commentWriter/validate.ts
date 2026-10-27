import { verifyEventDate } from "@/lib/eventDate"
import { hostnameOf, normalizeUrl } from "@/lib/url"
import type { ResearchResult } from "@/services/liveResearch"
import type { PromptBook } from "@/services/promptBook"
import { COMMENT_MAX_CHARS } from "@/constants/commentWriter"
import type { CommentReference } from "@/types/commentWriter"
import type { CommentDraft } from "./schema"
import { COMMENT_WRITER_TAGS } from "./blocks"

// Anything cited as a recent development must be at most a week old
const MAX_REFERENCE_AGE_DAYS = 7
// This many consecutive words shared with the application rules means they leaked
const LEAKED_RULES_RUN = 10
// This many consecutive words shared with the post means it was copied, not commented on
const COPIED_POST_RUN = 20
// Share of a claimed experience's significant words that must appear in the user's About Me profile
const MIN_EXPERIENCE_SUPPORT = 0.8
const MIN_SIGNIFICANT_WORD_LENGTH = 4
const WRAPPING_QUOTES = /^["“”']+|["“”']+$/g
const PLACEHOLDER = /\[[^\]\n]{1,60}\]/
const PROMPT_MARKUP = new RegExp(`<\\/?\\s*(${COMMENT_WRITER_TAGS.join("|")})\\b|\\{\\{\\w+\\}\\}`, "i")

export interface ValidationContext {
  postText: string
  systemPrompt: string
  experience: string | null
  // The tool's instructions prompt, whose words say what is wrong (the humanizer's retry reads them)
  book: PromptBook
}

export function cleanComment(raw: string): string {
  return raw.trim().replace(WRAPPING_QUOTES, "").trim()
}

function toWords(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
}

function sharesWordRun(text: string, source: string, runLength: number): boolean {
  const textWords = toWords(text)
  const sourceWords = toWords(source)
  if (textWords.length < runLength || sourceWords.length < runLength) return false
  const sourceRuns = new Set<string>()
  for (let index = 0; index + runLength <= sourceWords.length; index++) {
    sourceRuns.add(sourceWords.slice(index, index + runLength).join(" "))
  }
  for (let index = 0; index + runLength <= textWords.length; index++) {
    if (sourceRuns.has(textWords.slice(index, index + runLength).join(" "))) return true
  }
  return false
}

function isSupportedByExperience(quote: string, experience: string): boolean {
  const available = new Set(toWords(experience))
  const significant = toWords(quote).filter((word) => word.length >= MIN_SIGNIFICANT_WORD_LENGTH)
  if (significant.length === 0) return false
  return significant.filter((word) => available.has(word)).length / significant.length >= MIN_EXPERIENCE_SUPPORT
}

/**
 * The reference only counts when its URL was actually returned by the live search.
 */
export function findReference(draft: CommentDraft, research: ResearchResult | null): CommentReference | null {
  const url = normalizeUrl(draft.reference_url)
  const source = url ? research?.sources.find((candidate) => candidate.url === url) : undefined
  return source ? { url: source.url, title: source.title, source: hostnameOf(source.url) } : null
}

/**
 * Returns why a draft can't be shown, or null when it's usable. A reason makes the
 * writer retry with the fallback provider instead of returning a bad comment.
 * Citations are checked separately by findCitationProblem.
 */
export function findUnusableReason(draft: CommentDraft, context: ValidationContext): string | null {
  const { book } = context
  const comment = cleanComment(draft.comment)
  if (!comment) return book.text("problem.empty")
  if (!draft.post_main_point.trim()) return book.text("problem.missing-analysis")
  if (comment.length > COMMENT_MAX_CHARS) return book.text("problem.too-long", { length: comment.length, max: COMMENT_MAX_CHARS })
  if (PLACEHOLDER.test(comment)) return book.text("problem.placeholder")
  if (PROMPT_MARKUP.test(comment) || sharesWordRun(comment, context.systemPrompt, LEAKED_RULES_RUN)) return book.text("problem.leaks-prompt")
  if (sharesWordRun(comment, context.postText, COPIED_POST_RUN)) return book.text("problem.copies-post")

  const quote = draft.experience_quote.trim()
  if (quote && !(context.experience && isSupportedByExperience(quote, context.experience))) {
    return book.text("problem.unsupported-experience")
  }
  return null
}

/**
 * Checks the current-information claim separately from the rest of the draft: a cited
 * source must be one the live search returned, with an event date stated in the research
 * and no older than a week. Returns why the citation can't stand, or null.
 */
export function findCitationProblem(draft: CommentDraft, research: ResearchResult | null, now: Date): string | null {
  if (!draft.reference_url.trim()) return null
  const reference = findReference(draft, research)
  if (!reference) return "reference URL is not one of the verified search results"
  const evidence = `${research?.notes.toLowerCase() ?? ""}\n${reference.url.toLowerCase()}`
  return verifyEventDate(draft.event_date, now, evidence, MAX_REFERENCE_AGE_DAYS)
    ? null
    : `event date '${draft.event_date}' is unverified or older than ${MAX_REFERENCE_AGE_DAYS} days`
}
