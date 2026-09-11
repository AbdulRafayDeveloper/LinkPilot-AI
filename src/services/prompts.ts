import fs from "fs"
import path from "path"
import type { ConnectionNoteToneId } from "@/constants/connectionNote"
import type { FollowUpTypeId } from "@/constants/followUp"
import type { CommentTuneId } from "@/constants/commentWriter"
import type { FirstMessageTuneId } from "@/constants/firstMessage"
import type { InMailTuneId } from "@/constants/inmail"
import type { ReplyContextId, ReplyStyleId } from "@/constants/postCommentReplies"
import type { ConversationReplyTypeId } from "@/constants/conversationReply"
import type { GlobalPromptId } from "@/constants/globalPrompts"

const PROMPTS_DIR = path.join(process.cwd(), "src/prompts")

export type PromptName =
  | "trending-topics"
  | "trending-research"
  | "trending-search-lenses"
  | "trending-synthesis"
  | "connection-note-system"
  | `connection-note-${ConnectionNoteToneId}`
  | "follow-up-system"
  | `follow-up-${FollowUpTypeId}`
  | "comment-writer-system"
  | "post-image-extraction"
  | "comment-writer-research"
  | "comment-writer-research-lenses"
  | `comment-writer-${CommentTuneId}`
  | "sender-profile"
  | "first-message-system"
  | `first-message-${FirstMessageTuneId}`
  | "inmail-system"
  | `inmail-${InMailTuneId}`
  | "post-comment-reply-system"
  | "post-comment-reply-research"
  | `post-comment-reply-context-${ReplyContextId}`
  | `post-comment-reply-${ReplyContextId}-${ReplyStyleId}`
  | "conversation-reading"
  | "conversation-reply-analysis"
  | "conversation-reply-system"
  | `conversation-reply-${ConversationReplyTypeId}`
  | `global-${GlobalPromptId}`
  | "humanizer-system"

/**
 * Loads a prompt template from src/prompts. A missing template fails loudly instead of
 * letting a tool run with a degraded prompt.
 */
export function loadPrompt(templateName: PromptName): string {
  try {
    const filePath = path.join(PROMPTS_DIR, `${templateName}.md`)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8").trim()
    }
  } catch (error: unknown) {
    console.warn(`⚠️ Failed to load prompt template '${templateName}' from file system:`, error)
  }
  throw new Error(`PromptTemplateMissing: src/prompts/${templateName}.md could not be loaded`)
}

/**
 * Replaces {{VARIABLE}} placeholders in a prompt template. Unknown placeholders are left untouched.
 */
export function renderPrompt(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    key in variables ? String(variables[key]) : placeholder
  )
}
