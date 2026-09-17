import { loadPromptText } from "@/services/promptStore"
import type { ConnectionNoteToneId } from "@/constants/connectionNote"
import type { FollowUpPromptId } from "@/constants/followUp"
import type { CommentTuneId } from "@/constants/commentWriter"
import type { FirstMessageTuneId } from "@/constants/firstMessage"
import type { InMailTuneId } from "@/constants/inmail"
import type { ReplyContextId, ReplyStyleId } from "@/constants/postCommentReplies"
import type { MeetingPlannerPromptId } from "@/constants/meetingPlanner"
import type { ConversationReplyOwnPromptId } from "@/constants/conversationReply"
import type { GlobalPromptId } from "@/constants/globalPrompts"
import type { PromptTargetId } from "@/constants/promptCreator"

export type PromptName =
  | "trending-topics"
  | "trending-research"
  | "trending-search-lenses"
  | "trending-synthesis"
  | "connection-note-system"
  | `connection-note-${ConnectionNoteToneId}`
  | "follow-up-system"
  | `follow-up-${FollowUpPromptId}`
  | "lead-signals-system"
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
  | `conversation-reply-${ConversationReplyOwnPromptId}`
  | `global-${GlobalPromptId}`
  | "humanizer-system"
  | "prompt-creator-system"
  | `prompt-creator-${PromptTargetId}`
  | "client-message-system"
  | "client-message"
  | "meeting-prep-system"
  | "meeting-chat-system"
  | `meeting-prep-${MeetingPlannerPromptId}`
  | "meeting-system"
  | "meeting-chunk"
  | "meeting-synthesis"
  | "message-rewriter-system"
  | "message-rewriter"
  | "client-voice-tasks-system"
  | "client-voice-tasks"
  | "post-image-system"
  | "post-image"

/**
 * Loads a prompt template from the prompts collection. A missing template fails loudly
 * instead of letting a tool run with a degraded prompt.
 */
export function loadPrompt(templateName: PromptName): Promise<string> {
  return loadPromptText(templateName)
}

/**
 * Replaces {{VARIABLE}} placeholders in a prompt template. Unknown placeholders are left untouched.
 */
export function renderPrompt(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    key in variables ? String(variables[key]) : placeholder
  )
}
