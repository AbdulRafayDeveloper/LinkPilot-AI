import mongoose, { Schema, type Model } from "mongoose"
import type { LeadInfo } from "@/lib/leadInfo"
import { OWNER_ID } from "./owner"

/**
 * One collection per tool, one document per generation: who it was for (`lead`), what was
 * pasted and chosen, the text written, and the full result exactly as the page received it.
 */
interface RecordBase {
  // The account that made it (models/owner.ts)
  ownerId: string | null
  // The full result object, stored as is
  result: unknown
  // Which AI provider wrote it (the result's own `provider`), kept beside the result so a list can show it without reading the result
  provider: string | null
  createdAt: Date
  updatedAt: Date
}

interface LeadRecord extends RecordBase {
  lead: LeadInfo
}

export interface IConnectionNoteRecord extends LeadRecord {
  tone: string
  companyName: string | null
  profileData: string
  note: string
  characterCount: number
}

export interface ICommentRecord extends RecordBase {
  tune: string
  postSource: "text" | "image"
  postText: string | null
  comment: string
  characterCount: number
}

export interface IPostCommentReplyRecord extends RecordBase {
  context: string
  style: string
  postSource: "text" | "image" | "none"
  postText: string | null
  comments: string
  replyingTo: string | null
  reply: string
  characterCount: number
}

export interface IFollowUpMessageRecord extends LeadRecord {
  followUpType: string
  conversation: string
  profileData: string | null
  message: string
  characterCount: number
}

export interface IFirstMessageRecord extends LeadRecord {
  tune: string
  profileData: string
  message: string
  characterCount: number
}

export interface IInMailMessageRecord extends LeadRecord {
  tune: string
  profileData: string
  subject: string
  message: string
}

export interface IConversationReplyRecord extends LeadRecord {
  replyType: string
  conversation: string
  profileData: string | null
  reply: string
  strategyNote: string
  characterCount: number
}

export interface IClientMessageRecord extends RecordBase {
  client: { id: string; name: string; country: string }
  channel: string
  update: string
  subject: string | null
  message: string
  characterCount: number
}

export interface IRewrittenMessageRecord extends RecordBase {
  // Whether the original was typed or spoken
  source: string
  sourceLanguage: string
  original: string
  message: string
  characterCount: number
}

const LeadSchema = new Schema<LeadInfo>(
  {
    name: { type: String, default: null },
    headline: { type: String, default: null },
    company: { type: String, default: null },
  },
  { _id: false }
)

// Outputs are saved as they are, so a field is never rejected for being empty
const TEXT = { type: String, default: null }
const COUNT = { type: Number, default: null }
const LEAD = { type: LeadSchema, required: true }
// Who the client message went to, kept with the message itself
const ClientSchema = new Schema<IClientMessageRecord["client"]>(
  { id: { type: String, required: true }, name: { type: String, required: true }, country: { type: String, default: null } },
  { _id: false }
)
const RESULT = { type: Schema.Types.Mixed, required: true }

function recordModel<T>(name: string, schema: Schema<T>): Model<T> {
  schema.index({ createdAt: -1 })
  // Copied from the result as the record is written, so every tool's record says who wrote it without its own code
  schema.path("provider", { type: String, default: null })
  schema.pre("validate", function () {
    const result = this.get("result") as { provider?: unknown } | null
    if (!this.get("provider") && typeof result?.provider === "string") this.set("provider", result.provider)
  })
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema)
}

export const ConnectionNoteRecord = recordModel(
  "ConnectionNoteRecord",
  new Schema<IConnectionNoteRecord>(
    {
      ownerId: OWNER_ID,
      lead: LEAD,
      tone: TEXT,
      companyName: TEXT,
      profileData: TEXT,
      note: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "connection_notes" }
  )
)

export const CommentRecord = recordModel(
  "CommentRecord",
  new Schema<ICommentRecord>(
    {
      ownerId: OWNER_ID,
      tune: TEXT,
      postSource: { type: String, enum: ["text", "image"], required: true },
      postText: TEXT,
      comment: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "comment_writer_comments" }
  )
)

export const PostCommentReplyRecord = recordModel(
  "PostCommentReplyRecord",
  new Schema<IPostCommentReplyRecord>(
    {
      ownerId: OWNER_ID,
      context: TEXT,
      style: TEXT,
      postSource: { type: String, enum: ["text", "image", "none"], required: true },
      postText: TEXT,
      comments: TEXT,
      replyingTo: TEXT,
      reply: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "post_comment_replies" }
  )
)

export const FollowUpMessageRecord = recordModel(
  "FollowUpMessageRecord",
  new Schema<IFollowUpMessageRecord>(
    {
      ownerId: OWNER_ID,
      lead: LEAD,
      followUpType: TEXT,
      conversation: TEXT,
      profileData: TEXT,
      message: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "follow_up_messages" }
  )
)

export const FirstMessageRecord = recordModel(
  "FirstMessageRecord",
  new Schema<IFirstMessageRecord>(
    {
      ownerId: OWNER_ID,
      lead: LEAD,
      tune: TEXT,
      profileData: TEXT,
      message: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "first_messages" }
  )
)

export const InMailMessageRecord = recordModel(
  "InMailMessageRecord",
  new Schema<IInMailMessageRecord>(
    {
      ownerId: OWNER_ID,
      lead: LEAD,
      tune: TEXT,
      profileData: TEXT,
      subject: TEXT,
      message: TEXT,
      result: RESULT,
    },
    { timestamps: true, collection: "inmail_messages" }
  )
)

export const ConversationReplyRecord = recordModel(
  "ConversationReplyRecord",
  new Schema<IConversationReplyRecord>(
    {
      ownerId: OWNER_ID,
      lead: LEAD,
      replyType: TEXT,
      conversation: TEXT,
      profileData: TEXT,
      reply: TEXT,
      strategyNote: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "conversation_replies" }
  )
)

export const ClientMessageRecord = recordModel(
  "ClientMessageRecord",
  new Schema<IClientMessageRecord>(
    {
      ownerId: OWNER_ID,
      client: { type: ClientSchema, required: true },
      channel: TEXT,
      update: TEXT,
      subject: TEXT,
      message: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "client_messages" }
  )
)

export const RewrittenMessageRecord = recordModel(
  "RewrittenMessageRecord",
  new Schema<IRewrittenMessageRecord>(
    {
      ownerId: OWNER_ID,
      source: TEXT,
      sourceLanguage: TEXT,
      original: TEXT,
      message: TEXT,
      characterCount: COUNT,
      result: RESULT,
    },
    { timestamps: true, collection: "rewritten_messages" }
  )
)
