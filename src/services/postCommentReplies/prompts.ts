import type { PromptName } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt } from "@/services/promptStore"
import { REPLY_CONTEXTS, REPLY_STYLES, type ReplyContextId, type ReplyStyleId } from "@/constants/postCommentReplies"
import type { ReplyPrompt } from "@/types/postCommentReplies"

/**
 * Every context × style pair has its own prompt record, so editing one prompt can never
 * change another (including the same style in the other context).
 */
const replyPromptName = (context: ReplyContextId, style: ReplyStyleId): PromptName =>
  `post-comment-reply-${context}-${style}`

/**
 * Every context + style prompt in one query, ordered by context then style.
 */
export async function getPostCommentReplyPrompts(): Promise<ReplyPrompt[]> {
  const pairs = REPLY_CONTEXTS.flatMap((context) => REPLY_STYLES.map((style) => ({ context: context.id, style: style.id })))
  const stored = await getStoredPrompts(pairs.map(({ context, style }) => replyPromptName(context, style)))
  return pairs.map(({ context, style }, index) => ({ context, style, ...stored[index] }))
}

export async function getActiveReplyPrompt(context: ReplyContextId, style: ReplyStyleId): Promise<string> {
  const { prompt } = await getStoredPrompt(replyPromptName(context, style))
  return prompt
}

export async function saveReplyPrompt(context: ReplyContextId, style: ReplyStyleId, prompt: string): Promise<ReplyPrompt> {
  return { context, style, ...(await saveStoredPrompt(replyPromptName(context, style), prompt)) }
}
