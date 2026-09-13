/**
 * Post Comment Replies registry. Every context × style pair owns an independent,
 * separately stored prompt (default template: src/prompts/post-comment-reply-<context>-<style>.md),
 * so there is one prompt per pair and saving one can never change another.
 */
// Someone else's post comes first: it's the default and the more common case
export const REPLY_CONTEXTS = [
  { id: "other-post", label: "Someone Else's Post", description: "Reply in their thread" },
  { id: "my-post", label: "My Post", description: "Reply to comments on your post" },
] as const

export type ReplyContextId = (typeof REPLY_CONTEXTS)[number]["id"]

export const REPLY_CONTEXT_IDS = REPLY_CONTEXTS.map((context) => context.id) as [ReplyContextId, ...ReplyContextId[]]

export const DEFAULT_REPLY_CONTEXT: ReplyContextId = "other-post"

// Replies are written as this person; their own comments in a thread are never the ones answered
export const REPLY_AUTHOR_NAME = "Abdul Rafay"

// LinkedIn labels the viewer's own comments with their name, or "You" in some copies
export function isReplyAuthor(author: string | null): boolean {
  const name = author?.trim().toLowerCase() ?? ""
  return name === REPLY_AUTHOR_NAME.toLowerCase() || name === "you" || name === "me"
}

// Plain names on screen; the ids stay stable so saved prompts and selections keep working
export const REPLY_STYLES = [
  { id: "authority-builder", label: "Show Expertise", description: "Expert view + data" },
  { id: "curiosity-driver", label: "Ask Their Opinion", description: "Gets them talking" },
  { id: "value-demonstrator", label: "Give Useful Tips", description: "Helpful, no pitch" },
  { id: "experience-share", label: "Share Real Example", description: "Result + lesson" },
  { id: "contrarian-insight", label: "Politely Disagree", description: "Kind pushback" },
  { id: "come-on-dm", label: "Invite to DM", description: "Move talk to DM" },
] as const

export type ReplyStyleId = (typeof REPLY_STYLES)[number]["id"]

export const REPLY_STYLE_IDS = REPLY_STYLES.map((style) => style.id) as [ReplyStyleId, ...ReplyStyleId[]]

// Preselected so a reply can be generated right away; the user can pick another style
export const DEFAULT_REPLY_STYLE: ReplyStyleId = REPLY_STYLES[0].id

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
