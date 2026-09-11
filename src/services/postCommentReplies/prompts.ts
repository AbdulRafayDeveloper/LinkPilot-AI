import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import {
  REPLY_CONTEXTS,
  REPLY_STYLES,
  postCommentReplyPromptKey,
  type ReplyContextId,
  type ReplyStyleId,
} from "@/constants/postCommentReplies"
import type { ReplyPrompt } from "@/types/postCommentReplies"

/**
 * Every context × style pair has its own Setting record and its own default template,
 * so editing one prompt can never change another (including the same style in the other context).
 */
function replyPromptEntry(context: ReplyContextId, style: ReplyStyleId): PromptEntry {
  return {
    key: postCommentReplyPromptKey(context, style),
    defaultPrompt: loadPrompt(`post-comment-reply-${context}-${style}`),
  }
}

/**
 * All 14 prompts in one settings query, ordered by context then style.
 */
export async function getPostCommentReplyPrompts(): Promise<ReplyPrompt[]> {
  const pairs = REPLY_CONTEXTS.flatMap((context) =>
    REPLY_STYLES.map((style) => ({ context: context.id, style: style.id, entry: replyPromptEntry(context.id, style.id) }))
  )
  const stored = await getStoredPrompts(pairs.map(({ entry }) => entry))
  return pairs.map(({ context, style, entry }, index) => ({
    context,
    style,
    ...stored[index],
    defaultPrompt: entry.defaultPrompt,
  }))
}

export async function getActiveReplyPrompt(context: ReplyContextId, style: ReplyStyleId): Promise<string> {
  const { prompt } = await getStoredPrompt(replyPromptEntry(context, style))
  return prompt
}

export async function saveReplyPrompt(context: ReplyContextId, style: ReplyStyleId, prompt: string): Promise<ReplyPrompt> {
  const entry = replyPromptEntry(context, style)
  const saved = await saveStoredPrompt(entry, prompt)
  return { context, style, ...saved, defaultPrompt: entry.defaultPrompt }
}
