import { connectDB } from "@/lib/db"
import { leadFromConversation, leadFromProfile } from "@/lib/leadInfo"
import type { PostSource } from "@/lib/validation/postInput"
import {
  CommentRecord,
  ConnectionNoteRecord,
  ConversationReplyRecord,
  FirstMessageRecord,
  FollowUpMessageRecord,
  InMailMessageRecord,
  PostCommentReplyRecord,
} from "@/models/GenerationRecords"
import type { GeneratedConnectionNote } from "@/types/connectionNote"
import type { GeneratedComment } from "@/types/commentWriter"
import type { GeneratedReply } from "@/types/postCommentReplies"
import type { GeneratedFollowUp } from "@/types/followUp"
import type { GeneratedFirstMessage } from "@/types/firstMessage"
import type { GeneratedInMail } from "@/types/inmail"
import type { ConversationReplyResult } from "@/types/conversationReply"

/**
 * Saves every tool's output, with who it was for and what it was written from, to that tool's
 * collection. A record that can't be saved is logged and skipped: the user still gets the result.
 */
async function saveRecord(label: string, write: () => Promise<unknown>): Promise<void> {
  try {
    await connectDB()
    await write()
  } catch (error: unknown) {
    console.warn(`⚠️ Couldn't save the ${label} to the database:`, error instanceof Error ? error.message : error)
  }
}

const postText = (post: PostSource | null, extractedPost: string | null) =>
  post?.type === "text" ? post.text : extractedPost

export function recordConnectionNote(
  input: { profileData: string; companyName?: string },
  result: GeneratedConnectionNote
): Promise<void> {
  const lead = leadFromProfile(input.profileData)
  return saveRecord("connection note", () =>
    ConnectionNoteRecord.create({
      lead: { ...lead, company: input.companyName ?? lead.company },
      tone: result.tone,
      companyName: input.companyName ?? null,
      profileData: input.profileData,
      note: result.note,
      characterCount: result.characterCount,
      result,
    })
  )
}

export function recordComment(post: PostSource, result: GeneratedComment): Promise<void> {
  return saveRecord("comment", () =>
    CommentRecord.create({
      tune: result.tune,
      postSource: post.type,
      postText: postText(post, result.extractedPost),
      comment: result.comment,
      characterCount: result.characterCount,
      result,
    })
  )
}

export function recordPostCommentReply(input: { comments: string; post: PostSource | null }, result: GeneratedReply): Promise<void> {
  return saveRecord("comment reply", () =>
    PostCommentReplyRecord.create({
      context: result.context,
      style: result.style,
      postSource: input.post?.type ?? "none",
      postText: postText(input.post, result.extractedPost),
      comments: input.comments,
      replyingTo: result.replyingTo,
      reply: result.reply,
      characterCount: result.characterCount,
      result,
    })
  )
}

export function recordFollowUp(input: { conversation: string; profileData: string | null }, result: GeneratedFollowUp): Promise<void> {
  return saveRecord("follow-up message", () =>
    FollowUpMessageRecord.create({
      lead: leadFromConversation(input.conversation, input.profileData),
      followUpType: result.type,
      conversation: input.conversation,
      profileData: input.profileData,
      message: result.message,
      characterCount: result.characterCount,
      result,
    })
  )
}

export function recordFirstMessage(input: { profileData: string }, result: GeneratedFirstMessage): Promise<void> {
  return saveRecord("first message", () =>
    FirstMessageRecord.create({
      lead: leadFromProfile(input.profileData),
      tune: result.tune,
      profileData: input.profileData,
      message: result.message,
      characterCount: result.characterCount,
      result,
    })
  )
}

export function recordInMail(input: { profileData: string }, result: GeneratedInMail): Promise<void> {
  return saveRecord("InMail", () =>
    InMailMessageRecord.create({
      lead: leadFromProfile(input.profileData),
      tune: result.tune,
      profileData: input.profileData,
      subject: result.subject,
      message: result.message,
      result,
    })
  )
}

export function recordConversationReply(
  input: { conversation: string; profileData: string | null },
  result: ConversationReplyResult
): Promise<void> {
  return saveRecord("conversation reply", () =>
    ConversationReplyRecord.create({
      lead: leadFromConversation(input.conversation, input.profileData, result.analysis.parties.otherPersonName),
      replyType: result.replyType,
      conversation: input.conversation,
      profileData: input.profileData,
      reply: result.reply,
      strategyNote: result.strategyNote,
      characterCount: result.characterCount,
      result,
    })
  )
}
