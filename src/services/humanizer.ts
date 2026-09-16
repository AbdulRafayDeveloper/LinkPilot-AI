import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { getActiveGlobalPrompt } from "@/services/globalPrompts"
import { containsSenderClaim } from "@/services/senderGuard"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { applyHumanStyle, findAiWords } from "@/lib/humanStyle"
import { createTagSanitizer } from "@/lib/sanitize"

/**
 * The last step of every tool: the drafts it wrote are rewritten with the user's saved
 * Humanization prompt (Global AI Prompts) so they read like a person wrote them. The
 * rewrite may only change wording. Code checks that every number, link, hashtag and
 * @mention survives, that nothing new is claimed about the user or in AI-sounding words and
 * that each text keeps its limits; a tool can add its own checks. Drafts and rewrites alike
 * get the human style (lib/humanStyle.ts: no pause dashes, colons or semicolons, no
 * "seamless" or "robust"). Each text is judged on its own: a rewrite
 * that fails a check gets one targeted retry, and if that fails too, just that text keeps
 * its already-verified draft.
 */

const HUMANIZE_TEMPERATURE = 0.6
const DRAFTS_TAG = "texts_to_humanize"
const DRAFT_TAG = "draft"
const stripDraftTags = createTagSanitizer([DRAFTS_TAG, DRAFT_TAG])

const NUMBER = /\d+(?:[.,:]\d+)*/g
const URL = /https?:\/\/[^\s<>"'`\])]+/g
const HASHTAG = /#[\p{L}\p{N}_]+/gu
const MENTION = /(?<![\w.])@[\p{L}\p{N}_.-]+/gu
const MARKUP = new RegExp(`<\\/?\\s*(?:${DRAFTS_TAG}|${DRAFT_TAG})\\b|\\{\\{\\w+\\}\\}`, "i")

const HumanizedSchema = z.object({
  texts: z
    .array(
      z.object({
        id: z.string().describe("The draft's id, copied exactly"),
        text: z.string().describe("The humanized text only"),
      })
    )
    .describe("One entry per draft, in the same order"),
})

export interface HumanizeField<Id extends string> {
  id: Id
  // What the text is, e.g. "LinkedIn connection request note"
  kind: string
  text: string
  maxChars?: number
  singleLine?: boolean
  // An extra requirement for this text, e.g. a hook's word limit
  rule?: string
}

interface HumanizeOptions<Id extends string> {
  fields: HumanizeField<Id>[]
  signal: AbortSignal
  providers?: readonly ModelProvider[]
  onFallback?: () => void
  // The tool's own check on one rewritten text; a reason keeps that text's draft
  validate?: (id: Id, text: string) => string | null
}

export interface HumanizedTexts<Id extends string> {
  texts: Record<Id, string>
  // True when every text was humanized; texts whose rewrite failed a check keep their draft
  humanized: boolean
  provider: ModelProvider | null
}

const tokens = (text: string, pattern: RegExp) => new Set((text.match(pattern) ?? []).map((token) => token.toLowerCase()))

function describeTokenChange(draft: string, rewrite: string, pattern: RegExp, what: string): string | null {
  const before = tokens(draft, pattern)
  const after = tokens(rewrite, pattern)
  const lost = [...before].filter((token) => !after.has(token))
  const added = [...after].filter((token) => !before.has(token))
  if (lost.length > 0) return `dropped ${what} ${lost.join(", ")}`
  if (added.length > 0) return `added ${what} ${added.join(", ")}`
  return null
}

/**
 * Returns why a rewrite of one draft can't be used, or null when it can.
 */
function findFieldProblem<Id extends string>(field: HumanizeField<Id>, rewrite: string): string | null {
  if (!rewrite) return `${field.id}: empty`
  if (field.maxChars !== undefined && rewrite.length > field.maxChars) {
    return `${field.id}: ${rewrite.length} characters, over the ${field.maxChars}-character limit`
  }
  if (field.singleLine && /\n/.test(rewrite)) return `${field.id}: must be one line`
  if (MARKUP.test(rewrite)) return `${field.id}: contains prompt markup`
  if (containsPlaceholder(rewrite) && !containsPlaceholder(field.text)) return `${field.id}: contains a placeholder`
  if (containsSenderClaim(rewrite) && !containsSenderClaim(field.text)) return `${field.id}: adds a claim about the user`
  const aiWords = findAiWords(rewrite).filter((word) => !findAiWords(field.text).includes(word))
  if (aiWords.length > 0) return `${field.id}: uses AI-sounding words (${aiWords.join(", ")}); use plain everyday words`
  const changed =
    describeTokenChange(field.text, rewrite, URL, "links") ??
    describeTokenChange(field.text, rewrite, HASHTAG, "hashtags") ??
    describeTokenChange(field.text, rewrite, MENTION, "mentions") ??
    describeTokenChange(field.text, rewrite, NUMBER, "numbers")
  return changed ? `${field.id}: ${changed}` : null
}

function describeDraft<Id extends string>(field: HumanizeField<Id>): string {
  const attributes = [
    `id="${field.id}"`,
    `kind="${field.kind}"`,
    field.maxChars !== undefined && `max_chars="${field.maxChars}"`,
    field.singleLine && `one_line="true"`,
    field.rule && `rule="${field.rule}"`,
  ].filter(Boolean)
  return `<${DRAFT_TAG} ${attributes.join(" ")}>\n${stripDraftTags(field.text).trim()}\n</${DRAFT_TAG}>`
}

function draftsOf<Id extends string>(fields: HumanizeField<Id>[]): Record<Id, string> {
  return Object.fromEntries(fields.map((field) => [field.id, field.text])) as Record<Id, string>
}

// Every text leaves here in the human style (lib/humanStyle.ts), whether it's a rewrite or a kept draft
const styleOf = <Id extends string>(field: HumanizeField<Id>, text: string) =>
  applyHumanStyle(text, { maxChars: field.maxChars, singleLine: field.singleLine })

export async function humanizeTexts<Id extends string>({
  fields: rawFields,
  signal,
  providers,
  onFallback,
  validate,
}: HumanizeOptions<Id>): Promise<HumanizedTexts<Id>> {
  const fields = rawFields.map((field) => ({ ...field, text: styleOf(field, field.text) }))
  const drafts = draftsOf(fields)
  const toHumanize = fields.filter((field) => field.text.trim())
  if (toHumanize.length === 0) return { texts: drafts, humanized: false, provider: null }

  // Each text is judged on its own: a rewrite that passes every check replaces its draft
  const review = (subset: HumanizeField<Id>[], output: z.infer<typeof HumanizedSchema>) => {
    const byId = new Map(output.texts.map((entry) => [entry.id.trim(), cleanGeneratedText(entry.text)]))
    const accepted: Partial<Record<Id, string>> = {}
    const failed: HumanizeField<Id>[] = []
    const problems: string[] = []
    for (const field of subset) {
      const rewrite = styleOf(field, byId.get(field.id) ?? "")
      const problem = findFieldProblem(field, rewrite) ?? validate?.(field.id, rewrite) ?? null
      if (problem) {
        failed.push(field)
        problems.push(problem)
      } else {
        accepted[field.id] = rewrite
      }
    }
    return { accepted, failed, problems }
  }

  try {
    const [instructions, systemPrompt] = await Promise.all([getActiveGlobalPrompt("humanization"), loadPrompt("humanizer-system")])
    const rewrite = (subset: HumanizeField<Id>[], previousProblems: string[] = []) => {
      const user = composePromptMessage(instructions, [
        { variable: "text", tag: DRAFTS_TAG, label: "Texts to humanize", content: subset.map(describeDraft).join("\n\n") },
      ])
      const messages = [new SystemMessage(systemPrompt), new HumanMessage(user)]
      if (previousProblems.length > 0) {
        messages.push(
          new HumanMessage(
            `Your previous rewrite of these drafts broke a rule: ${previousProblems.join("; ")}. Rewrite them again and fix that, keeping every number, link, hashtag and @mention exactly as the draft has it and staying within each draft's limits.`
          )
        )
      }
      return generateStructuredWithFallback({
        schema: HumanizedSchema,
        name: "humanized_texts",
        messages,
        temperature: HUMANIZE_TEMPERATURE,
        providers,
        signal,
        onFallback,
        // The first answer is always reviewed text by text; on the retry, an answer with no
        // usable rewrite at all hands over to the next provider
        validate:
          previousProblems.length > 0
            ? (output) => {
                const { failed, problems } = review(subset, output)
                return failed.length === subset.length ? problems.join("; ") : null
              }
            : undefined,
      })
    }

    const first = await rewrite(toHumanize)
    const firstReview = review(toHumanize, first.data)
    const texts: Record<Id, string> = { ...drafts, ...firstReview.accepted }
    let { failed, problems } = firstReview

    // One targeted retry for the texts whose rewrite failed a check, told exactly why
    if (failed.length > 0) {
      const retry = await rewrite(failed, problems).catch((error: unknown) => {
        if (signal.aborted) throw error
        return null
      })
      if (retry) {
        const retryReview = review(failed, retry.data)
        Object.assign(texts, retryReview.accepted)
        failed = retryReview.failed
        problems = retryReview.problems
      }
    }
    if (failed.length > 0) {
      console.warn(`⚠️ Humanization kept ${failed.length} of ${toHumanize.length} drafts:`, problems.join("; "))
    }
    return { texts, humanized: failed.length === 0, provider: first.provider }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    // The drafts already passed the tool's checks, so they are a safe result
    console.warn("⚠️ Humanization skipped, returning the verified drafts:", error instanceof Error ? error.message : error)
    return { texts: drafts, humanized: false, provider: null }
  }
}
