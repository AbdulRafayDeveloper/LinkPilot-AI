/**
 * Post Comment Replies registry. Every context × style pair owns an independent,
 * separately stored prompt (default template: src/prompts/post-comment-reply-<context>-<style>.md),
 * so there are 14 prompts and saving one can never change another.
 */
// Someone else's post comes first: it's the default and the more common case
export const REPLY_CONTEXTS = [
  { id: "other-post", label: "Someone Else's Post", description: "Reply in their thread" },
  { id: "my-post", label: "My Post", description: "Reply to comments on your post" },
] as const

export type ReplyContextId = (typeof REPLY_CONTEXTS)[number]["id"]

export const REPLY_CONTEXT_IDS = REPLY_CONTEXTS.map((context) => context.id) as [ReplyContextId, ...ReplyContextId[]]

export const DEFAULT_REPLY_CONTEXT: ReplyContextId = "other-post"

export const REPLY_STYLES = [
  { id: "professional", label: "Professional", description: "Polished and respectful" },
  { id: "informative", label: "Informative", description: "Adds useful context" },
  { id: "informative-funny", label: "Informative + Funny", description: "Useful, with light humor" },
  { id: "questionable", label: "Questionable", description: "Opens a new angle" },
  { id: "conversation", label: "Conversation Carry-On", description: "Keeps the thread going" },
  { id: "pitch", label: "Pitch", description: "Connects to your expertise" },
  { id: "common-dm", label: "Common DM", description: "Casual, like a DM" },
] as const

export type ReplyStyleId = (typeof REPLY_STYLES)[number]["id"]

export const REPLY_STYLE_IDS = REPLY_STYLES.map((style) => style.id) as [ReplyStyleId, ...ReplyStyleId[]]

export function getReplyContextLabel(context: ReplyContextId): string {
  return REPLY_CONTEXTS.find((entry) => entry.id === context)?.label ?? context
}

export function getReplyStyleLabel(style: ReplyStyleId): string {
  return REPLY_STYLES.find((entry) => entry.id === style)?.label ?? style
}

export function postCommentReplyPromptKey(context: ReplyContextId, style: ReplyStyleId): string {
  return `post_comment_reply_prompt:${context}:${style}`
}

// Limit for the pasted comments; the post has its own limit (POST_TEXT_MAX_LENGTH)
export const REPLY_COMMENTS_MAX_LENGTH = 30000
// LinkedIn's maximum comment length; shown as guidance only, since each saved prompt sets the real length
export const LINKEDIN_COMMENT_MAX_CHARS = 1250

export const REPLY_STAGE_TEXT = {
  READING_POST: "Reading the post from your screenshot...",
  ANALYZING: "Analyzing the conversation...",
  WRITING: "Writing your reply...",
  HUMANIZING: "Making the reply sound natural...",
} as const

export type ReplyStage = keyof typeof REPLY_STAGE_TEXT

export const POST_COMMENT_REPLY_MESSAGES = {
  missingComment: "Please paste at least one comment to reply to.",
  missingContext: "Please choose My Post or Someone Else's Post.",
  missingStyle: "Please select a reply style.",
  commentsTooLong: `Comments must be under ${REPLY_COMMENTS_MAX_LENGTH.toLocaleString()} characters.`,
  generationFailed: "Unable to generate the reply right now. Please try again.",
} as const
