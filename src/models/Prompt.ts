import mongoose, { Schema, type Model } from "mongoose"

/**
 * Every prompt the app uses, one document per template (`key` = the template name, e.g.
 * "connection-note-warm"). `content` is the text the tools use; `defaultContent` is the original,
 * restored when the user saves the default text again. System prompts (`editable: false`)
 * are never changed from the app.
 */
export interface IPrompt {
  key: string
  tool: string
  editable: boolean
  content: string
  defaultContent: string
  createdAt: Date
  updatedAt: Date
}

const PromptSchema = new Schema<IPrompt>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    tool: { type: String, required: true, index: true },
    editable: { type: Boolean, required: true },
    content: { type: String, required: true },
    defaultContent: { type: String, required: true },
  },
  { timestamps: true, collection: "prompts" }
)

export const Prompt = (mongoose.models.Prompt as Model<IPrompt> | undefined) ?? mongoose.model<IPrompt>("Prompt", PromptSchema)
