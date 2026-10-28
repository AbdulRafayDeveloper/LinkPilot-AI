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
  // Each tool's instructions besides the prompts its users choose (services/promptBook.ts): the rewrite
  // requests, the problems its checks find, labels, empty texts and what each answer field means
  | "connection-note-instructions"
  | "comment-writer-instructions"
  | "post-comment-reply-instructions"
  | "follow-up-instructions"
  | "first-message-instructions"
  | "inmail-instructions"
  | "conversation-reply-instructions"
  | "trending-instructions"
  | "post-image-instructions"
  | "shared-instructions"
  | "prompt-creator-instructions"
  | "message-rewriter-instructions"
  | "quick-notes-instructions"
  | "client-projects-instructions"
  | "task-details-instructions"
  | "client-message-instructions"
  | "client-voices-instructions"
  | "meetings-instructions"
  | "meeting-planner-instructions"
  | "trending-topics"
  | "trending-research"
  | "trending-search-lenses"
  | "trending-synthesis"
  | "connection-note-system"
  | `connection-note-${ConnectionNoteToneId}`
  | "follow-up-system"
  | `follow-up-${FollowUpPromptId}`
  | "follow-up-lead-signals-system"
  | "conversation-reply-lead-signals-system"
  | "comment-writer-system"
  | "comment-writer-post-image-extraction"
  | "post-comment-reply-post-image-extraction"
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
  // Reading a description back in clear English (services/promptCreator/english.ts)
  | "prompt-creator-english"
  | "prompt-creator-english-system"
  | `prompt-creator-${PromptTargetId}`
  // Reading a spoken Quick Note back in English before it goes into the editor (services/quickNotes/english.ts)
  | "quick-notes-english"
  | "quick-notes-english-system"
  // Writing a project overview's voice out in English (services/clientProjects/voiceText.ts)
  | "client-project-voice-english"
  | "client-project-voice-english-system"
  | "client-message-system"
  | "client-message"
  | "meeting-prep-system"
  | "meeting-chat-system"
  | `meeting-prep-${MeetingPlannerPromptId}`
  | "meeting-system"
  | "meeting-chunk"
  | "meeting-synthesis"
  | "meeting-notes-chat-system"
  | "message-rewriter-system"
  | "message-rewriter"
  | "client-voice-tasks-system"
  | "client-voice-tasks"
  | "client-voice-clear-system"
  | "client-voice-clear"
  | "task-details-system"
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
