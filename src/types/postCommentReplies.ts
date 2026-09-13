import type { ReplyContextId, ReplyStage, ReplyStyleId } from "@/constants/postCommentReplies"
import type { PostInputMode } from "@/constants/postInput"
import type { EditablePrompt } from "./prompts"

export interface ReplyPrompt extends EditablePrompt {
  context: ReplyContextId
  style: ReplyStyleId
}

export interface TargetComment {
  author: string | null
  text: string
}

// What the page submits: the comments, plus the original post as text or a screenshot (optional)
export interface GenerateReplyRequest {
  context: ReplyContextId
  style: ReplyStyleId
  comments: string
  postMode: PostInputMode
  postText: string
  postImage: File | null
}

export interface GeneratedReply {
  reply: string
  context: ReplyContextId
  style: ReplyStyleId
  replyingTo: string | null
  characterCount: number
  maxCharacters: number
  warning: string | null
  // The post text read from an uploaded screenshot, so the user can check it
  extractedPost: string | null
}

export type ReplyStreamEvent =
  | { status: ReplyStage }
  | { status: "COMPLETE"; result: GeneratedReply }
  | { status: "ERROR"; message: string }
