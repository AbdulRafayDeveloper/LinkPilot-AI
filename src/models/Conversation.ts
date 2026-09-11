import mongoose, { Schema, Document as MongooseDocument } from "mongoose"

export interface IMessage {
  role: "user" | "assistant"
  content: string
  status?: string
  sources?: Array<{ source: string; score: number; content: string }>
  timestamp: Date
}

export interface IConversation extends MongooseDocument {
  title: string
  messages: IMessage[]
  isTemporary: boolean
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  status: { type: String },
  sources: [
    {
      source: { type: String, required: true },
      score: { type: Number, required: true },
      content: { type: String, required: true },
    },
  ],
  timestamp: { type: Date, default: Date.now },
})

const ConversationSchema = new Schema(
  {
    title: { type: String, required: true, default: "New Conversation" },
    messages: { type: [MessageSchema], default: [] },
    isTemporary: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
)

export const Conversation =
  mongoose.models.Conversation || mongoose.model<IConversation>("Conversation", ConversationSchema)
